import { prisma } from '../db/prisma.js';
import * as seedream from '../providers/seedream.js';
import * as seedance from '../providers/seedance.js';
import * as tts from '../providers/tts.js';
import { characterImagePrompt, sceneImagePrompt, shotImagePrompt } from '../prompts/image.js';
import videoPrompt from '../prompts/video.js';
import { buildContinuity } from '../prompts/continuity.js';
import { env } from '../config/env.js';
import { saveRemote, publicAssetUrl, parseJson } from './storageService.js';
import { AppError } from '../utils/AppError.js';

const RETRIES = 3;

function shotCharacters(shot, allCharacters) {
  const ids = new Set(parseJson(shot.characterIdsJson, []));
  return allCharacters.filter((character) => ids.has(character.id));
}

function previousShot(shots, shot) {
  const ordered = shots.filter((item) => item.episodeId === shot.episodeId).sort((a, b) => a.scene.sceneNumber - b.scene.sceneNumber || a.shotNumber - b.shotNumber);
  const index = ordered.findIndex((item) => item.id === shot.id);
  return index > 0 ? ordered[index - 1] : null;
}

async function addAsset(projectId, values) {
  return prisma.asset.create({ data: { projectId, ...values } });
}

export async function generateCharacterImage(characterId) {
  const character = await prisma.character.findUnique({ where: { id: characterId }, include: { project: true } });
  if (!character) throw new AppError('人物不存在', 404, 'NOT_FOUND');
  await prisma.character.update({ where: { id: characterId }, data: { imageStatus: 'running', imageError: '' } });
  try {
    const references = character.referenceImagePath ? [await publicAssetUrl(character.referenceImagePath)] : [];
    const image = await seedream.generateCharacterImage({
      projectId: character.projectId,
      prompt: characterImagePrompt(character, character.project.style),
      references
    });
    await prisma.$transaction([
      prisma.character.update({ where: { id: characterId }, data: { referenceImagePath: image.filePath, imageStatus: 'succeeded' } }),
      prisma.asset.create({ data: { projectId: character.projectId, shotId: '', type: 'character_image', filePath: image.filePath, sourceProvider: 'seedream' } })
    ]);
    await addAsset(character.projectId, { shotId: '', type: 'character_image', filePath: image.filePath, sourceProvider: 'seedream' });
    return image;
  } catch (error) {
    await prisma.character.update({ where: { id: characterId }, data: { imageStatus: 'failed', imageError: error.code || 'SEEDREAM_FAILED' } });
    throw error;
  }
}

export async function generateSceneImage(sceneId) {
  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, include: { project: true } });
  if (!scene) throw new AppError('场景不存在', 404, 'NOT_FOUND');
  await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: 'running' } });
  try {
    const image = await seedream.generateSceneImage({ projectId: scene.projectId, prompt: sceneImagePrompt(scene, scene.project.style) });
    await prisma.scene.update({ where: { id: sceneId }, data: { imagePath: image.filePath, imageStatus: 'succeeded' } });
    await addAsset(scene.projectId, { type: 'scene_image', filePath: image.filePath, sourceProvider: 'seedream' });
    return image;
  } catch (error) {
    await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: 'failed' } });
    throw error;
  }
}

export async function generateShotImage(shotId) {
  const shot = await prisma.shot.findUnique({ where: { id: shotId }, include: { project: true, scene: true } });
  if (!shot) throw new AppError('镜头不存在', 404, 'NOT_FOUND');
  const [characters, shots] = await Promise.all([
    prisma.character.findMany({ where: { projectId: shot.projectId } }),
    prisma.shot.findMany({ where: { projectId: shot.projectId }, include: { scene: true } })
  ]);
  const linkedCharacters = shotCharacters(shot, characters);
  const previous = previousShot(shots, shot);
  const references = [];
  for (const character of linkedCharacters) if (character.referenceImagePath) references.push(await publicAssetUrl(character.referenceImagePath));
  if (shot.scene.imagePath) references.push(await publicAssetUrl(shot.scene.imagePath));
  if (previous?.lastFramePath) references.push(await publicAssetUrl(previous.lastFramePath));
  const continuity = buildContinuity(previous, shot, linkedCharacters);
  await prisma.shot.update({ where: { id: shotId }, data: { imageStatus: 'running', imageError: '', continuityJson: JSON.stringify(continuity) } });
  try {
    const result = await seedream.generateShotImage({
      projectId: shot.projectId,
      prompt: `${shotImagePrompt({ ...shot, continuityJson: JSON.stringify(continuity) }, linkedCharacters, shot.project.style)}\n${JSON.stringify(continuity)}`,
      references
    });
    await prisma.shot.update({ where: { id: shotId }, data: { imagePath: result.filePath, imageStatus: 'succeeded' } });
    await addAsset(shot.projectId, { shotId, type: 'shot_image', filePath: result.filePath, sourceProvider: 'seedream' });
    return result;
  } catch (error) {
    await prisma.shot.update({ where: { id: shotId }, data: { imageStatus: 'failed', imageError: error.code || 'SEEDREAM_FAILED' } });
    throw error;
  }
}

export async function createShotVideo(shotId) {
  const shot = await prisma.shot.findUnique({ where: { id: shotId }, include: { project: true, episode: true, scene: true } });
  if (!shot) throw new AppError('镜头不存在', 404, 'NOT_FOUND');
  const active = await prisma.aiTask.findFirst({ where: { projectId: shot.projectId, type: 'video', status: { in: ['queued', 'running'] }, taskId: { not: '' } } });
  if (active && active.shotId !== shotId) throw new AppError('当前已有一个 Seedance 任务运行中，请等待其完成', 409, 'VIDEO_CONCURRENCY_LIMIT');
  const characters = await prisma.character.findMany({ where: { projectId: shot.projectId } });
  const linkedCharacters = shotCharacters(shot, characters);
  const shots = await prisma.shot.findMany({ where: { projectId: shot.projectId }, include: { scene: true } });
  const previous = previousShot(shots, shot);
  const imageReference = previous?.lastFramePath || shot.imagePath;
  const imageUrl = imageReference ? await publicAssetUrl(imageReference) : '';
  const lastFrameUrl = shot.lastFramePath ? await publicAssetUrl(shot.lastFramePath) : '';
  const remote = await seedance.createVideoTask({
    imageUrl, lastFrameUrl,
    prompt: videoPrompt(shot, linkedCharacters, shot.project.style),
    duration: shot.duration, aspectRatio: '16:9'
  });
  await prisma.$transaction([
    prisma.shot.update({ where: { id: shotId }, data: { videoTaskId: remote.taskId, videoStatus: 'queued', videoProgress: 0, videoError: '' } }),
    prisma.aiTask.create({ data: {
      projectId: shot.projectId, shotId, provider: 'seedance', type: 'video', taskId: remote.taskId,
      status: 'queued', progress: 0, requestJson: JSON.stringify({ imageUrl, prompt: shot.videoPrompt, duration: shot.duration, aspectRatio: '16:9' })
    } })
  ]);
  return remote;
}

export async function getShotVideoStatus(shotId) {
  const shot = await prisma.shot.findUnique({ where: { id: shotId }, include: { project: true } });
  if (!shot) throw new AppError('镜头不存在', 404, 'NOT_FOUND');
  if (!shot.videoTaskId) throw new AppError('此镜头没有真实 Seedance task_id', 404, 'TASK_NOT_FOUND');
  if (['succeeded', 'failed', 'expired'].includes(shot.videoStatus)) return { status: shot.videoStatus, progress: shot.videoProgress, videoUrl: shot.videoPath ? `/uploads/${shot.videoPath}` : '', error: shot.videoError };
  const task = await prisma.aiTask.findFirst({ where: { shotId, type: 'video', taskId: shot.videoTaskId } });
  const pollCount = (task?.pollCount || 0) + 1;
  if (pollCount > env.videoMaxPolls) {
    await prisma.$transaction([
      prisma.shot.update({ where: { id: shotId }, data: { videoStatus: 'expired', videoError: 'TASK_TIMEOUT' } }),
      prisma.aiTask.update({ where: { id: task.id }, data: { status: 'expired', error: 'TASK_TIMEOUT' } })
    ]);
    return { status: 'expired', progress: shot.videoProgress, error: '任务超过30分钟查询上限' };
  }
  let remote;
  try { remote = await seedance.getVideoTask(shot.videoTaskId); }
  catch (error) {
    if (task) {
      const attempts = task.attempts + 1;
      const failed = attempts >= RETRIES;
      await prisma.aiTask.update({ where: { id: task.id }, data: { attempts, pollCount, status: failed ? 'failed' : 'running', error: failed ? error.message : '' } });
      if (failed) await prisma.shot.update({ where: { id: shotId }, data: { videoStatus: 'failed', videoError: error.code || 'SEEDANCE_TASK_FAILED' } });
    }
    throw error;
  }
  const status = String(remote.status || '').toLowerCase();
  if (['succeeded', 'success', 'completed'].includes(status)) {
    if (!remote.videoUrl) throw new AppError('Seedance 成功响应中没有 video_url', 502, 'SEEDANCE_TASK_FAILED');
    const video = await saveRemote('videos', shot.projectId, remote.videoUrl, 'mp4');
    const lastFrame = remote.lastFrameUrl ? await saveRemote('images', shot.projectId, remote.lastFrameUrl, 'png') : null;
    await prisma.$transaction([
      prisma.shot.update({ where: { id: shotId }, data: { videoPath: video.filePath, lastFramePath: lastFrame?.filePath || shot.lastFramePath, videoStatus: 'succeeded', videoProgress: 100, videoError: '' } }),
      ...(task ? [prisma.aiTask.update({ where: { id: task.id }, data: { status: 'succeeded', progress: 100, pollCount, error: '' } })] : []),
      prisma.asset.create({ data: { projectId: shot.projectId, shotId, type: 'video', filePath: video.filePath, sourceProvider: 'seedance', sourceTaskId: shot.videoTaskId } }),
      ...(lastFrame ? [prisma.asset.create({ data: { projectId: shot.projectId, shotId, type: 'last_frame', filePath: lastFrame.filePath, sourceProvider: 'seedance', sourceTaskId: shot.videoTaskId } })] : [])
    ]);
    return { status: 'succeeded', progress: 100, videoUrl: `/uploads/${video.filePath}`, lastFrameUrl: lastFrame ? `/uploads/${lastFrame.filePath}` : '' };
  }
  if (['failed', 'cancelled', 'canceled', 'expired'].includes(status)) {
    const finalStatus = status === 'expired' ? 'expired' : 'failed';
    await prisma.$transaction([
      prisma.shot.update({ where: { id: shotId }, data: { videoStatus: finalStatus, videoError: String(remote.error || 'Seedance task failed') } }),
      ...(task ? [prisma.aiTask.update({ where: { id: task.id }, data: { status: finalStatus, pollCount, error: String(remote.error || 'Seedance task failed') } })] : [])
    ]);
    return { status: finalStatus, progress: 0, error: remote.error || '视频生成失败' };
  }
  const progress = Math.max(0, Math.min(99, Number(remote.progress) || (status === 'running' ? 10 : 0)));
  await prisma.$transaction([
    prisma.shot.update({ where: { id: shotId }, data: { videoStatus: ['running', 'processing'].includes(status) ? 'running' : 'queued', videoProgress: progress } }),
    ...(task ? [prisma.aiTask.update({ where: { id: task.id }, data: { status: ['running', 'processing'].includes(status) ? 'running' : 'queued', progress, pollCount, error: '' } })] : [])
  ]);
  return { status: ['running', 'processing'].includes(status) ? 'running' : 'queued', progress };
}

export async function generateShotSpeech(shotId, dialogueIndex) {
  const shot = await prisma.shot.findUnique({ where: { id: shotId } });
  if (!shot) throw new AppError('镜头不存在', 404, 'NOT_FOUND');
  const dialogue = parseJson(shot.dialogueJson, []);
  const line = dialogue[dialogueIndex];
  if (!line) throw new AppError('对白不存在', 404, 'NOT_FOUND');
  const character = await prisma.character.findUnique({ where: { id: line.characterId } });
  if (!character) throw new AppError('对白没有匹配人物', 400, 'CHARACTER_REQUIRED');
  const audio = await tts.generateSpeech({ projectId: shot.projectId, character, text: line.text, emotion: line.emotion || shot.emotion, speed: line.speed });
  const assets = parseJson(shot.audioAssetsJson, []);
  assets[dialogueIndex] = { characterId: character.id, characterName: character.name, filePath: audio.filePath, duration: audio.duration, dialogueIndex };
  const complete = dialogue.every((_, index) => Boolean(assets[index]?.filePath));
  await prisma.$transaction([
    prisma.shot.update({ where: { id: shotId }, data: { audioAssetsJson: JSON.stringify(assets), audioStatus: complete ? 'succeeded' : 'running' } }),
    prisma.asset.create({ data: { projectId: shot.projectId, shotId, type: 'audio', filePath: audio.filePath, sourceProvider: 'doubao_tts' } })
  ]);
  return { ...audio, url: `/uploads/${audio.filePath}` };
}

async function enqueue(projectId, type, shotId, dialogueIndex, extra = {}) {
  const requestJson = JSON.stringify({ ...extra, dialogueIndex });
  const characterId = type === 'character_image' ? String(extra.characterId || '') : '';
  const existing = await prisma.aiTask.findFirst({ where: { projectId, type, shotId, characterId, status: { in: ['queued', 'running', 'succeeded'] } } });
  if (existing) return null;
  return prisma.aiTask.create({ data: { projectId, shotId: shotId || '', characterId, provider: type === 'tts' ? 'doubao_tts' : 'seedream', type, requestJson } });
}

export async function startAssetQueue(projectId, types = ['images', 'videos', 'speech']) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { characters: true, scenes: true, shots: true } });
  if (!project) throw new AppError('项目不存在', 404, 'NOT_FOUND');
  const queued = [];
  for (const character of project.characters) {
    if (types.includes('images') && !character.referenceImagePath) {
      const task = await enqueue(projectId, 'character_image', '', null, { characterId: character.id });
      if (task) queued.push(task);
    }
  }
  for (const scene of project.scenes) {
    if (types.includes('images') && !scene.imagePath) {
      const task = await enqueue(projectId, 'scene_image', scene.id, null);
      if (task) queued.push(task);
    }
  }
  for (const shot of project.shots) {
    if (types.includes('images') && !shot.imagePath) {
      const task = await enqueue(projectId, 'shot_image', shot.id, null);
      if (task) queued.push(task);
    }
    if (types.includes('videos') && !shot.videoPath) {
      const task = await enqueue(projectId, 'video', shot.id, null);
      if (task) queued.push(task);
    }
    if (types.includes('speech')) {
      const dialogue = parseJson(shot.dialogueJson, []);
      const assets = parseJson(shot.audioAssetsJson, []);
      for (let index = 0; index < dialogue.length; index += 1) {
        if (!dialogue[index].characterId || assets[index]?.filePath) continue;
        const task = await enqueue(projectId, 'tts', shot.id, index);
        if (task) queued.push(task);
      }
    }
  }
  return { queued: queued.length, tasks: queued, limits: { images: 2, videos: 1, speech: 1 } };
}

export async function runAssetTask(taskId) {
  const task = await prisma.aiTask.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('素材任务不存在', 404, 'NOT_FOUND');
  const claim = await prisma.aiTask.updateMany({ where: { id: taskId, status: 'queued' }, data: { status: 'running', attempts: { increment: 1 } } });
  if (!claim.count) return prisma.aiTask.findUnique({ where: { id: taskId } });
  try {
    const payload = parseJson(task.requestJson, {});
    if (task.type === 'character_image') await generateCharacterImage(payload.characterId);
    else if (task.type === 'scene_image') await generateSceneImage(task.shotId);
    else if (task.type === 'shot_image') await generateShotImage(task.shotId);
    else if (task.type === 'tts') await generateShotSpeech(task.shotId, payload.dialogueIndex);
    else if (task.type === 'video') {
      await createShotVideo(task.shotId);
      await prisma.aiTask.update({ where: { id: taskId }, data: { status: 'succeeded', progress: 100, error: '' } });
      return prisma.aiTask.findUnique({ where: { id: taskId } });
    } else throw new AppError('未知素材任务类型', 400, 'INVALID_ARGUMENT');
    return prisma.aiTask.update({ where: { id: taskId }, data: { status: 'succeeded', progress: 100, error: '' } });
  } catch (error) {
    const status = task.attempts + 1 < RETRIES && error.code !== 'CONFIG_MISSING' ? 'queued' : 'failed';
    await prisma.aiTask.update({ where: { id: taskId }, data: { status, error: error.code || error.message } });
    throw error;
  }
}

export async function retryAssetTask(taskId) {
  const task = await prisma.aiTask.findUnique({ where: { id: taskId } });
  if (!task || !['failed', 'expired'].includes(task.status)) throw new AppError('只有失败/过期任务可重试', 409, 'INVALID_TASK_STATE');
  return prisma.aiTask.update({ where: { id: taskId }, data: { status: 'queued', attempts: 0, pollCount: 0, error: '' } });
}

export async function generateCharacterPhoto(characterId) {
  return generateCharacterImage(characterId);
}

export async function regenerateShotPrompt(shotId) {
  const shot = await prisma.shot.findUnique({ where: { id: shotId }, include: { episode: true } });
  if (!shot) throw new AppError('镜头不存在', 404, 'NOT_FOUND');
  return shot;
}

/**
 * 串行执行项目素材队列中的全部任务（一键生成）。
 * 先入队，再逐个 await 执行；单个任务失败不中断整体。
 * 注意：视频任务仅创建远程任务并立即标记 succeeded，生成结果由轮询异步完成。
 * @param {string} projectId 项目 ID
 * @param {string[]} types 需要生成的素材类型
 * @returns {Promise<{total: number, succeeded: number, failed: number, results: Array<{taskId: string, type: string, status: string, error?: string}>}>}
 */
export async function runQueueSerially(projectId, types) {
  const { tasks } = await startAssetQueue(projectId, types);
  const results = [];
  let succeeded = 0;
  let failed = 0;
  for (const task of tasks) {
    try {
      await runAssetTask(task.id);
      succeeded += 1;
      results.push({ taskId: task.id, type: task.type, status: 'succeeded' });
    } catch (error) {
      failed += 1;
      results.push({ taskId: task.id, type: task.type, status: 'failed', error: error.code || error.message });
    }
  }
  return { total: tasks.length, succeeded, failed, results };
}