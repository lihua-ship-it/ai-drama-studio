import { env, requireConfig } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { requestJson } from '../utils/http.js';
import storyPrompt from '../prompts/story.js';
import charactersPrompt from '../prompts/characters.js';
import scriptPrompt from '../prompts/script.js';
import storyboardPrompt from '../prompts/storyboard.js';
import imagePrompts from '../prompts/imagePrompts.js';

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

async function completeJSON(task, prompt, validate, retryCount = 3) {
  const key = requireConfig('DEEPSEEK_API_KEY', env.deepseekApiKey);
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await requestJson(`${env.deepseekBaseUrl}/chat/completions`, {
        method: 'POST',
        timeout: env.httpTimeoutMs,
        code: 'DEEPSEEK_REQUEST_FAILED',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model: env.deepseekModel,
          messages: [
            { role: 'system', content: `你是短剧制作系统的结构化生成器。只返回 JSON，不得返回 Markdown。当前任务：${task}` },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          thinking: { type: 'disabled' },
          temperature: 0.7,
          max_tokens: 30000
        }
      });
      const choice = response.choices?.[0];
      const content = choice?.message?.content;
      if (!content || choice.finish_reason === 'length') throw new AppError('模型返回为空或内容被截断', 502, 'DEEPSEEK_JSON_INVALID');
      let parsed;
      try { parsed = JSON.parse(content); }
      catch (error) { throw new AppError('DeepSeek 返回内容不是有效 JSON', 502, 'DEEPSEEK_JSON_INVALID', error.message); }
      if (validate && !validate(parsed)) throw new AppError('DeepSeek JSON 未通过结构校验', 502, 'DEEPSEEK_JSON_INVALID');
      return parsed;
    } catch (error) {
      lastError = error;
      console.error('DeepSeek attempt failed', { task, attempt, code: error.code, message: error.message, details: error.details });
      if (['CONFIG_MISSING', 'CONTENT_REJECTED'].includes(error.code)) throw error;
    }
  }
  throw lastError;
}

export function generateStory(input) {
  return completeJSON('故事策划', storyPrompt(input), (value) => nonEmpty(value.title) && nonEmpty(value.synopsis) && Array.isArray(value.characterBriefs) && value.characterBriefs.length > 0);
}

export function generateCharacters(input) {
  return completeJSON('人物文字设定', charactersPrompt(input), (value) => Array.isArray(value.characters) && value.characters.length > 0 && value.characters.every((item) => nonEmpty(item.name) && nonEmpty(item.identity) && nonEmpty(item.personality) && nonEmpty(item.relationships)));
}

export function generateScript(input) {
  return completeJSON('分集剧本', scriptPrompt(input), (value) => Array.isArray(value.episodes)
    && value.episodes.length === input.episodeCount
    && value.episodes.every((episode) => nonEmpty(episode.title) && nonEmpty(episode.summary) && nonEmpty(episode.endingHook)
      && Array.isArray(episode.scenes) && episode.scenes.length > 0
      && episode.scenes.every((scene) => nonEmpty(scene.location) && Array.isArray(scene.dialogue) && scene.dialogue.length > 0
        && scene.dialogue.every((line) => nonEmpty(line.characterName) && nonEmpty(line.text)))));
}

export function generateStoryboard(input) {
  return completeJSON('镜头分镜', storyboardPrompt(input), (value) => {
    if (!Array.isArray(value.shots) || !value.shots.length) return false;
    const valid = value.shots.every((shot) => Number.isInteger(Number(shot.episodeNumber))
      && Number.isInteger(Number(shot.sceneNumber)) && Number.isInteger(Number(shot.shotNumber))
      && nonEmpty(shot.action) && nonEmpty(shot.imagePrompt) && nonEmpty(shot.videoPrompt)
      && Array.isArray(shot.characterNames) && Array.isArray(shot.dialogue) && shot.continuity);
    return valid && input.scenes.every((scene) => value.shots.filter((shot) => Number(shot.episodeNumber) === Number(scene.episodeNumber) && Number(shot.sceneNumber) === Number(scene.sceneNumber)).length >= 2);
  });
}

export async function generateImagePrompts(input) {
  const sources = input.shots.map((shot) => ({
    shotId: shot.id,
    episodeNumber: shot.episode.episodeNumber,
    shotNumber: shot.shotNumber,
    imagePrompt: shot.imagePrompt,
    negativePrompt: shot.negativePrompt,
    videoPrompt: shot.videoPrompt,
    continuity: shot.continuityJson,
    characters: input.characters.filter((character) => JSON.parse(shot.characterIdsJson || '[]').includes(character.id)).map((character) => ({
      name: character.name, faceDescription: character.faceDescription, hairDescription: character.hairDescription,
      bodyDescription: character.bodyDescription, clothingDescription: character.clothingDescription
    }))
  }));
  const result = await completeJSON('图片与视频 Prompt 优化', imagePrompts({ style: input.style, shots: sources }), (value) => Array.isArray(value.shots) && value.shots.length === sources.length && value.shots.every((shot) => shot.shotId && nonEmpty(shot.imagePrompt) && nonEmpty(shot.videoPrompt)));
  const originals = new Map(sources.map((shot) => [shot.shotId, shot]));
  for (const shot of result.shots) {
    if (!originals.has(shot.shotId) || shot.imagePrompt.length > env.maxPromptLength || shot.videoPrompt.length > env.maxPromptLength) {
      throw new AppError('生成的 Prompt 缺失或过长', 502, 'DEEPSEEK_JSON_INVALID');
    }
    shot.continuityJson = originals.get(shot.shotId).continuity;
  }
  return result;
}