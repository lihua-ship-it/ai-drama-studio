import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });

export const env = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  uploadDir: path.resolve(here, '..', process.env.UPLOAD_DIR || './uploads'),
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, ''),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
  deepseekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  volcengineApiKey: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY || '',
  arkBaseUrl: (process.env.VOLCENGINE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, ''),
  volcTextModel: process.env.VOLC_TEXT_MODEL || '',
  seedreamModel: process.env.SEEDREAM_MODEL || '',
  seedanceModel: process.env.SEEDANCE_MODEL || '',
  ttsResourceId: process.env.TTS_RESOURCE_ID || '',
  ttsUrl: process.env.VOLCENGINE_TTS_URL || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse',
  videoMaxPolls: Number(process.env.VIDEO_MAX_POLLS || 180),
  videoPollIntervalMs: Number(process.env.VIDEO_POLL_INTERVAL_MS || 10000),
  httpTimeoutMs: 120000,
  maxPromptLength: 12000,
  maxEpisodes: 12,
  maxMediaBytes: 200 * 1024 * 1024
};

export function requireConfig(name, value) {
  if (!value || !String(value).trim()) {
    const error = new Error(`Missing server/.env value: ${name}`);
    error.code = 'CONFIG_MISSING';
    error.status = 503;
    throw error;
  }
  return value;
}

export function aiConfigStatus() {
  return {
    deepseek: Boolean(env.deepseekApiKey),
    volcengine: Boolean(env.volcengineApiKey)
  };
}