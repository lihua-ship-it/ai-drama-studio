import { tts } from 'edge-tts/out/index.js';
import { AppError } from '../utils/AppError.js';
import { classifyProviderError, publicProviderMessage } from '../utils/providerErrors.js';
import { saveBuffer } from '../services/storageService.js';

// Edge-TTS 默认中文音色（无 Key、无配额，完全免费）。
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

// 前端仍保留 voiceId 自由文本概念，这里将其映射到 Edge-TTS 内置音色。
// Edge-TTS 不使用火山豆包的 speaker id，仅需一个合法的 Edge voice 名。
const VOICE_ALIASES = {
  female: 'zh-CN-XiaoxiaoNeural',
  male: 'zh-CN-YunxiNeural',
  女: 'zh-CN-XiaoxiaoNeural',
  男: 'zh-CN-YunxiNeural',
  xiaoxiao: 'zh-CN-XiaoxiaoNeural',
  yunxi: 'zh-CN-YunxiNeural',
  xiaoyi: 'zh-CN-XiaoyiNeural',
  yunjian: 'zh-CN-YunjianNeural',
  yunyang: 'zh-CN-YunyangNeural',
  yunxia: 'zh-CN-YunxiaNeural',
  xiaobei: 'zh-CN-XiaobeiNeural'
};

function resolveVoice(character) {
  const raw = String(character?.voiceId || '').trim();
  if (!raw) return DEFAULT_VOICE;
  // 若已是 Edge 音色全名（如 zh-CN-XiaoxiaoNeural），直接透传。
  if (/^[a-z]{2}-[a-z]{2}-[a-z0-9-]+neural$/i.test(raw)) return raw;
  return VOICE_ALIASES[raw.toLowerCase()] || DEFAULT_VOICE;
}

export async function generateSpeech({ projectId, character, text, emotion, speed = 1 }) {
  if (!text || Buffer.byteLength(text, 'utf8') > 1024) throw new AppError('对白为空或超过 TTS 1024 字节限制', 400, 'INVALID_ARGUMENT');
  const voice = resolveVoice(character);
  // Edge-TTS 的 rate 用百分比字符串（正数需带 + 号），speed 0.5~2 -> -50% ~ +100%
  const clampedSpeed = Math.max(0.5, Math.min(2, Number(speed) || 1));
  const ratePercent = Math.round((clampedSpeed - 1) * 100);
  const rate = `${ratePercent > 0 ? '+' : ''}${ratePercent}%`;
  let audio;
  try {
    // emotion 参数 Edge-TTS 不支持，直接忽略。
    audio = await tts(text, { voice, rate, volume: '+0%', pitch: '+0Hz' });
  } catch (error) {
    const detail = String(error?.message || error).slice(0, 500);
    const code = classifyProviderError(0, detail) || 'TTS_FAILED';
    throw new AppError(publicProviderMessage(code, '微软 Edge-TTS 语音合成失败，请稍后重试。'), 502, code, detail);
  }
  if (!audio || !audio.length) throw new AppError('Edge-TTS 未返回音频数据', 502, 'TTS_FAILED');
  // Edge-TTS 不返回时长，按字符数粗估（秒），保证返回结构含 duration 字段。
  const duration = Math.max(1, Math.round(text.length * 0.3));
  return { ...(await saveBuffer('audio', projectId, audio, 'audio/mpeg', 'mp3')), duration };
}
