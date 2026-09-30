const API_ERROR_MESSAGES = {
  API_KEY_INVALID: 'AI 密钥无效，请检查服务端环境变量。',
  MODEL_PERMISSION_DENIED: '当前账号没有此模型的调用权限，请检查模型开通状态。',
  INSUFFICIENT_BALANCE: '当前AI模型额度已使用完，请充值或更换可用额度后继续。',
  QUOTA_EXHAUSTED: '当前AI模型额度或并发限制已用完，请稍后重试或检查套餐额度。',
  MODEL_NOT_AVAILABLE: '当前模型不可用，请检查模型 ID/Endpoint 和区域配置。'
};

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.error?.code || 'HTTP_ERROR';
    const error = new Error(API_ERROR_MESSAGES[code] || payload.error?.message || `请求失败 (${response.status})`);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

const post = (path, data = {}) => request(path, { method: 'POST', body: JSON.stringify(data) });
const patch = (path, data = {}) => request(path, { method: 'PATCH', body: JSON.stringify(data) });

export const api = {
  projects: {
    list: () => request('/projects'),
    create: (data) => post('/projects', data),
    get: (projectId) => request(`/projects/${projectId}`),
    story: (projectId) => post(`/projects/${projectId}/story`),
    characters: (projectId) => post(`/projects/${projectId}/characters`),
    script: (projectId, data = {}) => post(`/projects/${projectId}/script`, data),
    storyboard: (projectId, data = {}) => post(`/projects/${projectId}/storyboard`, data),
    imagePrompts: (projectId, data = {}) => post(`/projects/${projectId}/image-prompts`, data),
    queue: (projectId, types) => post(`/projects/${projectId}/assets/queue`, { types }),
    updateCharacter: (characterId, data) => patch(`/projects/characters/${characterId}`, data),
    runTask: (taskId) => post(`/projects/tasks/${taskId}/run`),
    retryTask: (taskId) => post(`/projects/tasks/${taskId}/retry`)
  },
  media: {
    characterImage: (characterId) => post(`/characters/${characterId}/image`),
    sceneImage: (sceneId) => post(`/scenes/${sceneId}/image`),
    shotImage: (shotId) => post(`/shots/${shotId}/image`),
    shotVideo: (shotId) => post(`/shots/${shotId}/video`),
    videoStatus: (shotId) => request(`/shots/${shotId}/video/status`),
    speech: (shotId, dialogueIndex) => post(`/shots/${shotId}/tts`, { dialogueIndex })
  }
};