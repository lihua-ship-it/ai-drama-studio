import { env, requireConfig } from '../config/env.js';
import { requestJson } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';
import { saveRemote, saveBuffer } from '../services/storageService.js';

export async function generateImage({ projectId, prompt, references = [], kind, ownerId }) {
  if (!prompt || prompt.length > env.maxPromptLength) throw new AppError('图片 Prompt 为空或过长', 400, 'INVALID_ARGUMENT');
  const key = requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
  const model = requireConfig('SEEDREAM_MODEL', env.seedreamModel);
  const imageUrls = references.filter(Boolean).slice(0, 10);
  const body = { model, prompt, size: '2K', response_format: 'url', watermark: false };
  if (imageUrls.length) body.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  const result = await requestJson(`${env.arkBaseUrl}/images/generations`, {
    method: 'POST', timeout: env.httpTimeoutMs, code: 'SEEDREAM_FAILED',
    headers: { Authorization: `Bearer ${key}` }, body
  });
  const image = result.data?.[0];
  if (image?.url) return saveRemote(kind || 'images', projectId, image.url, 'png');
  if (image?.b64_json) return saveBuffer(kind || 'images', projectId, Buffer.from(image.b64_json, 'base64'), 'image/png', 'png');
  throw new AppError('Seedream 响应中没有图片内容', 502, 'SEEDREAM_FAILED', JSON.stringify(result).slice(0, 500));
}

export const generateCharacterImage = (input) => generateImage({ ...input, kind: 'images' });
export const generateSceneImage = (input) => generateImage({ ...input, kind: 'images' });
export const generateShotImage = (input) => generateImage({ ...input, kind: 'images' });