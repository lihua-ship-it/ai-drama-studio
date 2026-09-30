export function classifyProviderError(status, detail = '') {
  const message = String(detail || '').toLowerCase();
  if (/insufficient balance|not enough balance|balance insufficient|insufficient funds|payment required|credits exhausted/.test(message)) return 'INSUFFICIENT_BALANCE';
  if (/quota exhausted|quota exceeded|rate.?limit|too many requests|concurrency limit/.test(message) || status === 429) return 'QUOTA_EXHAUSTED';
  if (/model.*(not found|unavailable|not available|does not exist)/.test(message) || status === 404) return 'MODEL_NOT_AVAILABLE';
  if (/invalid (api )?key|api.?key.*invalid|unauthorized|authentication failed/.test(message) || status === 401) return 'API_KEY_INVALID';
  if (/permission denied|not authorized|access denied|model.*permission/.test(message) || status === 403) return 'MODEL_PERMISSION_DENIED';
  return '';
}

const PUBLIC_MESSAGES = {
  API_KEY_INVALID: 'AI 密钥无效，请检查 server/.env 中对应 Key。',
  MODEL_PERMISSION_DENIED: '当前账号没有此模型的调用权限，请检查模型开通状态。',
  INSUFFICIENT_BALANCE: '当前AI模型额度已使用完，请充值或更换可用额度后继续。',
  QUOTA_EXHAUSTED: '当前AI模型额度或并发限制已用完，请稍后重试或检查套餐额度。',
  MODEL_NOT_AVAILABLE: '当前模型不可用，请检查模型 ID/Endpoint 和区域配置。'
};

export function publicProviderMessage(code, fallback = 'AI 服务请求失败，请查看后端日志。') {
  return PUBLIC_MESSAGES[code] || fallback;
}