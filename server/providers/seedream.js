import { env, requireConfig } from '../config/env.js';
import { requestJson } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';
import { saveRemote, saveBuffer } from '../services/storageService.js';

// 智谱 CogView 生图接口地址
const ZHIPU_IMAGE_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';

export async function generateImage({ projectId, prompt, references = [], kind, ownerId }) {
  if (!prompt || prompt.length > env.maxPromptLength) throw new AppError('图片 Prompt 为空或过长', 400, 'INVALID_ARGUMENT');
  // 智谱生图不支持参考图/尺寸/水印等火山特有参数，references 仅保留签名向后兼容、不参与请求体
  const key = requireConfig('ZHIPU_API_KEY', env.zhipuApiKey);
  const model = requireConfig('ZHIPU_IMAGE_MODEL', env.zhipuImageModel);
  const result = await requestJson(ZHIPU_IMAGE_URL, {
    method: 'POST', timeout: env.httpTimeoutMs, code: 'SEEDREAM_FAILED',
    headers: { Authorization: `Bearer ${key}` }, body: { model, prompt }
  });
  const image = result.data?.[0];
  if (image?.url) return saveRemote(kind || 'images', projectId, image.url, 'png');
  if (image?.b64_json) return saveBuffer(kind || 'images', projectId, Buffer.from(image.b64_json, 'base64'), 'image/png', 'png');
  throw new AppError('CogView 响应中没有图片内容', 502, 'SEEDREAM_FAILED', JSON.stringify(result).slice(0, 500));
}

export const generateCharacterImage = (input) => generateImage({ ...input, kind: 'images' });
export const generateSceneImage = (input) => generateImage({ ...input, kind: 'images' });
export const generateShotImage = (input) => generateImage({ ...input, kind: 'images' });
