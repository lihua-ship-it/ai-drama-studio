export function parseJson(value, fallback = []) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

export function mediaUrl(path) {
  return path ? `/uploads/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';
}

export function formatDate(value) {
  if (!value) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}