import crypto from 'node:crypto';
import { env, requireConfig } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { classifyProviderError, publicProviderMessage } from '../utils/providerErrors.js';
import { saveBuffer } from '../services/storageService.js';

export async function generateSpeech({ projectId, character, text, emotion, speed = 1 }) {
  if (!text || Buffer.byteLength(text, 'utf8') > 1024) throw new AppError('对白为空或超过 TTS 1024 字节限制', 400, 'INVALID_ARGUMENT');
  if (!character?.voiceId) throw new AppError('请先为人物配置 voiceId', 400, 'VOICE_ID_MISSING');
  const apiKey = requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
  const resourceId = requireConfig('TTS_RESOURCE_ID', env.ttsResourceId);
  const speechRate = Math.round((Math.max(0.5, Math.min(2, Number(speed) || 1)) - 1) * 100);
  const response = await fetch(env.ttsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': crypto.randomUUID()
    },
    body: JSON.stringify({
      user: { uid: character.id },
      req_params: {
        text,
        speaker: character.voiceId,
        audio_params: { format: 'mp3', sample_rate: 24000, speech_rate, emotion: emotion || 'neutral' },
        additions: { silence_duration: 125 }
      }
    }),
    signal: AbortSignal.timeout(env.httpTimeoutMs)
  });
  if (!response.ok) {
    const detail = `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
    const code = classifyProviderError(response.status, detail) || 'TTS_FAILED';
    throw new AppError(publicProviderMessage(code, '豆包语音请求失败，请检查服务端日志。'), 502, code, detail);
  }
  const raw = await response.text();
  const chunks = [];
  let duration = 0;
  let finished = false;
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const dataLine = block.split(/\r?\n/).find((line) => line.startsWith('data:'));
    if (!dataLine) continue;
    let event;
    try { event = JSON.parse(dataLine.slice(5).trim()); }
    catch (error) { throw new AppError('TTS 返回无效 SSE 数据', 502, 'TTS_FAILED', error.message); }
    if (event.code === 0 && event.data) chunks.push(Buffer.from(event.data, 'base64'));
    for (const word of event.sentence?.words || []) duration = Math.max(duration, Number(word.endTime) || 0);
    if (event.code === 20000000) finished = true;
    else if (event.code !== 0) {
      const detail = event.message || '';
      const code = classifyProviderError(200, `${event.code} ${detail}`) || 'TTS_FAILED';
      throw new AppError(publicProviderMessage(code, `豆包语音错误 ${event.code}`), 502, code, detail);
    }
  }
  const audio = Buffer.concat(chunks);
  if (!finished || !audio.length) throw new AppError('TTS 流未正常结束或没有音频', 502, 'TTS_FAILED');
  if (duration > 1000) duration /= 1000;
  return { ...(await saveBuffer('audio', projectId, audio, 'audio/mpeg', 'mp3')), duration };
}