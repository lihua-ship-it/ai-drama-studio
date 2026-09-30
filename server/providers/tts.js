import { AppError } from '../utils/AppError.js';

// 配音环节暂缓接入：微软 Edge-TTS 接口已被封禁（403），且智谱/火山 TTS 均收费。
// 当前无可用免费语音服务，故保留 generateSpeech 签名并直接抛出可读的 503，优雅降级。
export async function generateSpeech() {
  throw new AppError('配音功能暂未开放（当前未接入可用的免费语音服务），请先用视频功能完成制作。', 503, 'TTS_NOT_AVAILABLE');
}
