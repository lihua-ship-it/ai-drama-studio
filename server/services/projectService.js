import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import * as deepseek from '../providers/deepseek.js';
import { parseJson } from './storageService.js';
import { AppError } from '../utils/AppError.js';

const nowProgress = (stage, detail = {}) => JSON.stringify({ stage, ...detail });
const boundedText = (value, limit) => String(value || '').trim().slice(0, limit);

function validateProject(input = {}) {
  const theme = String(input.theme || '').trim();
  const episodeCount = Number(input.episodeCount);
  const durationPerEpisode = Number(input.durationPerEpisode);
  if (!theme) throw new AppError('短剧主题不能为空', 400, 'INVALID_ARGUMENT');
  if (theme.length > 1200) throw new AppError('短剧主题不能超过1200字', 400, 'INVALID_ARGUMENT');
  if (!Number.isInteger(episodeCount) || episodeCount < 1 || episodeCount > 12) throw new AppError('集数需要在1至12之间', 400, 'INVALID_ARGUMENT');
  if (!Number.isInteger(durationPerEpisode) || durationPerEpisode < 1 || durationPerEpisode > 30) throw new AppError('单集时长需要在1至30分钟之间', 400, 'INVALID_ARGUMENT');
  for (const key of ['characterRequirements', 'storyRequirements', 'visualStyle']) {
    if (String(input[key] || '').length > 2000) throw new AppError(`${key} 不能超过2000字`, 400, 'INVALID_ARGUMENT');
  }
  return { theme, episodeCount, durationPerEpisode };
}

export async function createProject(input) {
  const values = validateProject(input);
  const requestKey = boundedText(input.requestKey, 100) || crypto.randomUUID();
  const existing = await prisma.project.findUnique({ where: { requestKey } });
  if (existing) return existing;
  const storySeed = {
    openid: undefined,
    requestKey,
    title: values.theme.slice(0, 80),
    theme: values.theme,
    genre: boundedText(input.genre, 40) || '都市',
    style: boundedText(input.visualStyle, 300) || '电影级写实，16:9',
    episodeCount: values.episodeCount,
    durationPerEpisode: values.durationPerEpisode,
    characterRequirements: boundedText(input.characterRequirements, 2000),
    storyRequirements: boundedText(input.storyRequirements, 2000),
    status: 'created',
    progressJson: nowProgress('story', { story: 'idle', characters: 'idle', script: 'idle', storyboard: 'idle' })
  };
  delete storySeed.openid;
  return prisma.project.create({ data: storySeed });
}

export function listProjects() {
  return prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, select: {
    id: true, title: true, theme: true, genre: true, style: true, episodeCount: true,
    durationPerEpisode: true, status: true, progressJson: true, createdAt: true, updatedAt: true
  } });
}

export async function getProjectSnapshot(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      characters: { orderBy: { createdAt: 'asc' } },
      episodes: { orderBy: { episodeNumber: 'asc' }, include: { scenes: { orderBy: { sceneNumber: 'asc' } }, shots: { orderBy: { shotNumber: 'asc' } } } },
      scenes: { orderBy: [{ episodeId: 'asc' }, { sceneNumber: 'asc' }] },
      shots: { orderBy: [{ episodeId: 'asc' }, { shotNumber: 'asc' }] },
      assets: { orderBy: { createdAt: 'desc' }, take: 500 },
      aiTasks: { orderBy: { createdAt: 'desc' }, take: 500 }
    }
  });
  if (!project) throw new AppError('项目不存在', 404, 'NOT_FOUND');
  const progress = {
    keyframes: project.shots.filter((shot) => shot.imageStatus === 'succeeded').length,
    videos: project.shots.filter((shot) => shot.videoStatus === 'succeeded').length,
    speech: project.shots.reduce((sum, shot) => sum + parseJson(shot.audioAssetsJson, []).length, 0),
    totalShots: project.shots.length,
    activeTasks: project.aiTasks.filter((task) => ['queued', 'running'].includes(task.status)).length
  };
  const { characters, episodes, scenes, shots, assets, aiTasks, ...projectRecord } = project;
  const combinedProgress = { ...parseJson(project.progressJson, {}), ...progress };
  return {
    project: { ...projectRecord, story: parseJson(project.storyJson, {}), progress: combinedProgress },
    characters,
    episodes,
    scenes,
    shots,
    assets,
    aiTasks,
    progress: combinedProgress
  };
}

async function persistCharacters(project, generated) {
  const current = await prisma.character.findMany({ where: { projectId: project.id } });
  const byName = new Map(current.map((character) => [character.name, character]));
  const records = [];
  for (const item of generated.characters) {
    const previous = byName.get(item.name);
    const data = {
      projectId: project.id, name: item.name, age: item.age || '', gender: item.gender || '',
      identity: item.identity || '', personality: item.personality || '', appearance: item.appearance || '',
      faceDescription: item.faceDescription, hairDescription: item.hairDescription,
      bodyDescription: item.bodyDescription, clothingDescription: item.clothingDescription,
      voiceProfile: item.voiceProfile || '', relationships: item.relationships || '', imagePrompt: item.imagePrompt,
      voiceId: previous?.voiceId || '', referenceImagePath: previous?.referenceImagePath || '',
      imageStatus: previous?.imageStatus || 'idle'
    };
    const record = previous
      ? await prisma.character.update({ where: { id: previous.id }, data })
      : await prisma.character.create({ data });
    records.push(record);
  }
  return records;
}

export async function generateStage(projectId, stage, options = {}) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError('项目不存在', 404, 'NOT_FOUND');
  const progress = parseJson(project.progressJson, {});
  const characters = await prisma.character.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });

  if (stage === 'story') {
    await prisma.project.update({ where: { id: projectId }, data: { status: 'generating_story', progressJson: nowProgress('story', { ...progress, story: 'running' }) } });
    const story = await deepseek.generateStory(project);
    return prisma.project.update({ where: { id: projectId }, data: {
      title: story.title, logline: story.logline || '', synopsis: story.synopsis || '', storyJson: JSON.stringify(story),
      status: 'story_ready', progressJson: nowProgress('characters', { ...progress, story: 'succeeded' })
    } });
  }

  if (stage === 'characters') {
    const story = parseJson(project.storyJson, {});
    if (!story.title) throw new AppError('请先生成故事策划', 409, 'STAGE_REQUIRED');
    const generated = await deepseek.generateCharacters({ story, characters: story.characterBriefs || [] });
    const saved = await persistCharacters(project, generated);
    await prisma.project.update({ where: { id: projectId }, data: { status: 'characters_ready', progressJson: nowProgress('script', { ...progress, characters: 'succeeded' }) } });
    return { characters: saved };
  }

  if (stage === 'script' || stage === 'episodeScript') {
    if (!project.logline || !characters.length) throw new AppError('请先生成故事与人物', 409, 'STAGE_REQUIRED');
    const allEpisodes = await prisma.episode.findMany({ where: { projectId }, orderBy: { episodeNumber: 'asc' } });
    const targetEpisode = stage === 'episodeScript' ? allEpisodes.find((episode) => episode.episodeNumber === Number(options.episodeNumber)) : null;
    if (stage === 'episodeScript' && !targetEpisode) throw new AppError('分集不存在', 404, 'NOT_FOUND');
    const generated = await deepseek.generateScript({
      story: parseJson(project.storyJson, {}), characters,
      episodeCount: targetEpisode ? 1 : project.episodeCount,
      durationPerEpisode: project.durationPerEpisode,
      storyRequirements: project.storyRequirements
    });
    const targetNumbers = targetEpisode ? [targetEpisode.episodeNumber] : [];
    await prisma.$transaction(async (tx) => {
      if (targetEpisode) {
        await tx.episode.delete({ where: { id: targetEpisode.id } });
      } else {
        await tx.episode.deleteMany({ where: { projectId } });
      }
      for (const item of generated.episodes) {
        const episodeNumber = targetEpisode?.episodeNumber || Number(item.episodeNumber);
        const episode = await tx.episode.create({ data: { projectId, episodeNumber, title: item.title, summary: item.summary, endingHook: item.endingHook } });
        for (const scene of item.scenes) {
          await tx.scene.create({ data: {
            projectId, episodeId: episode.id, sceneNumber: Number(scene.sceneNumber), location: scene.location,
            time: scene.time || '', atmosphere: scene.atmosphere || '', description: scene.description || '',
            dialogueJson: JSON.stringify(scene.dialogue || [])
          } });
        }
      }
    });
    const updatedProgress = { ...progress, script: 'succeeded', stage: 'storyboard' };
    await prisma.project.update({ where: { id: projectId }, data: { status: 'script_ready', progressJson: JSON.stringify(updatedProgress) } });
    return { episodes: generated.episodes.length, episodeNumbers: targetNumbers };
  }

  if (stage === 'storyboard') {
    const episodes = await prisma.episode.findMany({ where: { projectId }, orderBy: { episodeNumber: 'asc' }, include: { scenes: true } });
    const targetEpisodes = options.episodeNumber ? episodes.filter((episode) => episode.episodeNumber === Number(options.episodeNumber)) : episodes;
    if (!targetEpisodes.length || !characters.length) throw new AppError('请先生成完整剧本与人物', 409, 'STAGE_REQUIRED');
    const scenes = targetEpisodes.flatMap((episode) => episode.scenes.map((scene) => ({ ...scene, episodeNumber: episode.episodeNumber })));
    const generated = await deepseek.generateStoryboard({ episodes: targetEpisodes, scenes, characters, durationPerEpisode: project.durationPerEpisode, visualStyle: project.style });
    const episodeByNumber = new Map(targetEpisodes.map((episode) => [episode.episodeNumber, episode]));
    const sceneByKey = new Map(scenes.map((scene) => [`${scene.episodeNumber}:${scene.sceneNumber}`, scene]));
    await prisma.$transaction(async (tx) => {
      if (options.episodeNumber) await tx.shot.deleteMany({ where: { projectId, episodeId: episodeByNumber.get(Number(options.episodeNumber)).id } });
      else await tx.shot.deleteMany({ where: { projectId } });
      for (const shot of generated.shots) {
        const episode = episodeByNumber.get(Number(shot.episodeNumber));
        const scene = sceneByKey.get(`${shot.episodeNumber}:${shot.sceneNumber}`);
        if (!episode || !scene) throw new AppError('DeepSeek 分镜引用了不存在的场景', 502, 'DEEPSEEK_JSON_INVALID');
        const linked = characters.filter((character) => shot.characterNames.includes(character.name));
        if (linked.length !== shot.characterNames.length) throw new AppError('分镜使用了人物表中不存在的角色', 502, 'DEEPSEEK_JSON_INVALID');
        const dialogue = (shot.dialogue || []).map((line) => {
          const character = characters.find((item) => item.name === line.characterName);
          return { ...line, characterId: character?.id || '', voiceId: character?.voiceId || line.voiceId || '', speed: Number(line.speed) || 1 };
        });
        await tx.shot.create({ data: {
          projectId, episodeId: episode.id, sceneId: scene.id, shotNumber: Number(shot.shotNumber),
          shotType: shot.shotType || '', cameraAngle: shot.cameraAngle || '', cameraMovement: shot.cameraMovement || '',
          duration: Number(shot.duration) || 5, characterIdsJson: JSON.stringify(linked.map((item) => item.id)),
          characterNamesJson: JSON.stringify(linked.map((item) => item.name)), action: shot.action || '',
          dialogueJson: JSON.stringify(dialogue), emotion: shot.emotion || '', imagePrompt: shot.imagePrompt,
          negativePrompt: shot.negativePrompt || '', videoPrompt: shot.videoPrompt, continuityJson: JSON.stringify(shot.continuity),
          imageStatus: 'idle', videoStatus: 'idle', audioStatus: dialogue.length ? 'idle' : 'succeeded'
        } });
      }
    });
    await prisma.project.update({ where: { id: projectId }, data: { status: 'storyboard_ready', progressJson: nowProgress('imagePrompts', { ...progress, storyboard: 'succeeded' }) } });
    return { shots: generated.shots.length };
  }

  if (stage === 'imagePrompts') {
    let shots = await prisma.shot.findMany({ where: { projectId }, include: { episode: true } });
    if (options.shotId) shots = shots.filter((shot) => shot.id === options.shotId);
    if (options.episodeNumber) shots = shots.filter((shot) => shot.episode.episodeNumber === Number(options.episodeNumber));
    if (!shots.length) throw new AppError('请先生成分镜', 409, 'STAGE_REQUIRED');
    const optimized = await deepseek.generateImagePrompts({ shots, characters, style: project.style });
    for (const result of optimized.shots) {
      const original = shots.find((shot) => shot.id === result.shotId);
      await prisma.shot.update({ where: { id: original.id }, data: {
        imagePrompt: result.imagePrompt, negativePrompt: result.negativePrompt || original.negativePrompt,
        videoPrompt: result.videoPrompt, continuityJson: result.continuityJson || original.continuityJson
      } });
    }
    return { shots: optimized.shots.length };
  }

  throw new AppError('未知生成阶段', 400, 'INVALID_ARGUMENT');
}

export async function updateCharacter(characterId, patch) {
  const allowed = {};
  for (const key of ['voiceId']) if (patch[key] !== undefined) allowed[key] = boundedText(patch[key], 120);
  if (!Object.keys(allowed).length) throw new AppError('没有可更新的人物字段', 400, 'INVALID_ARGUMENT');
  return prisma.character.update({ where: { id: characterId }, data: allowed });
}