import { env, requireConfig } from '../config/env.js';
import { requestJson } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';

// 智谱 CogVideoX 生视频接口地址
const ZHIPU_VIDEO_CREATE_URL = 'https://open.bigmodel.cn/api/paas/v4/videos/generations';
const ZHIPU_VIDEO_QUERY_URL = 'https://open.bigmodel.cn/api/paas/v4/async-result';

// 智谱 task_status -> 内部 status 映射（PROCESSING/SUCCESS/FAIL）
function mapStatus(taskStatus) {
  if (taskStatus === 'SUCCESS') return 'succeeded';
  if (taskStatus === 'FAIL') return 'failed';
  return 'running';
}

export async function createVideoTask({ imageUrl, lastFrameUrl, prompt, duration = 5, aspectRatio = '16:9' }) {
  // 智谱 cogvideox-flash 为文生视频，不支持 imageUrl/lastFrameUrl 首尾帧，忽略这些参数只用 prompt
  if (!prompt || prompt.length > env.maxPromptLength) throw new AppError('视频 Prompt 为空或过长', 400, 'INVALID_ARGUMENT');
  const key = requireConfig('ZHIPU_API_KEY', env.zhipuApiKey);
  const model = requireConfig('ZHIPU_VIDEO_MODEL', env.zhipuVideoModel);
  const result = await requestJson(ZHIPU_VIDEO_CREATE_URL, {
    method: 'POST', timeout: 60000, code: 'SEEDANCE_CREATE_FAILED',
    headers: { Authorization: `Bearer ${key}` }, body: { model, prompt }
  });
  const taskId = result.id || result.task_id;
  if (!taskId) throw new AppError('CogVideoX 未返回真实 task_id', 502, 'SEEDANCE_CREATE_FAILED');
  return { taskId, status: mapStatus(result.task_status) };
}

export async function getVideoTask(taskId) {
  if (!taskId) throw new AppError('缺少真实 CogVideoX task_id', 400, 'INVALID_ARGUMENT');
  const key = requireConfig('ZHIPU_API_KEY', env.zhipuApiKey);
  const result = await requestJson(`${ZHIPU_VIDEO_QUERY_URL}/${encodeURIComponent(taskId)}`, {
    timeout: 30000, code: 'SEEDANCE_TASK_FAILED', headers: { Authorization: `Bearer ${key}` }
  });
  const status = mapStatus(result.task_status);
  const videoUrl = result.video_result?.[0]?.url || '';
  return {
    status,
    progress: status === 'succeeded' ? 100 : 0,
    videoUrl,
    // 智谱 flash 不返回尾帧图，固定置空
    lastFrameUrl: '',
    error: result.error?.message || result.error || ''
  };
}
