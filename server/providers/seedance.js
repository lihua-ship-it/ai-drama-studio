import { env, requireConfig } from '../config/env.js';
import { requestJson } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';

export async function createVideoTask({ imageUrl, lastFrameUrl, prompt, duration = 5, aspectRatio = '16:9' }) {
  if (!imageUrl || !prompt || prompt.length > env.maxPromptLength) throw new AppError('Seedance 首帧或 Prompt 无效', 400, 'INVALID_ARGUMENT');
  const key = requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
  const model = requireConfig('SEEDANCE_MODEL', env.seedanceModel);
  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageUrl }, role: 'first_frame' }
  ];
  if (lastFrameUrl) content.push({ type: 'image_url', image_url: { url: lastFrameUrl }, role: 'last_frame' });
  const result = await requestJson(`${env.arkBaseUrl}/contents/generations/tasks`, {
    method: 'POST', timeout: 60000, code: 'SEEDANCE_CREATE_FAILED',
    headers: { Authorization: `Bearer ${key}` },
    body: { model, content, duration: Math.max(3, Math.min(15, Number(duration) || 5)), ratio: aspectRatio, return_last_frame: true, watermark: false }
  });
  const taskId = result.id || result.task_id;
  if (!taskId) throw new AppError('Seedance 未返回真实 task_id', 502, 'SEEDANCE_CREATE_FAILED');
  return { taskId, status: result.status || 'queued' };
}

export async function getVideoTask(taskId) {
  if (!taskId) throw new AppError('缺少真实 Seedance task_id', 400, 'INVALID_ARGUMENT');
  const key = requireConfig('VOLCENGINE_API_KEY', env.volcengineApiKey);
  const result = await requestJson(`${env.arkBaseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    timeout: 30000, code: 'SEEDANCE_TASK_FAILED', headers: { Authorization: `Bearer ${key}` }
  });
  return {
    status: result.status,
    progress: result.progress,
    videoUrl: result.content?.video_url || result.video_url || result.output?.video_url || '',
    lastFrameUrl: result.content?.last_frame_url || result.last_frame_url || result.output?.last_frame_url || '',
    error: result.error?.message || result.error || ''
  };
}