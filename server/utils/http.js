import { AppError } from './AppError.js';
import { classifyProviderError, publicProviderMessage } from './providerErrors.js';

export async function requestJson(url, { method = 'GET', headers = {}, body, timeout = 120000, code = 'UPSTREAM_FAILED' } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    throw new AppError(timedOut ? '上游请求超时' : '无法连接上游服务', 502, timedOut ? 'TASK_TIMEOUT' : code, error.message);
  }
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new AppError('上游服务返回了无效 JSON', 502, code, raw.slice(0, 600)); }
  if (!response.ok) {
    const message = result.error?.message || result.message || `HTTP ${response.status}`;
    const rejected = /content|safety|moderation/i.test(message);
    const classifiedCode = rejected ? 'CONTENT_REJECTED' : classifyProviderError(response.status, message) || code;
    throw new AppError(rejected ? '内容未通过模型审核' : publicProviderMessage(classifiedCode, 'AI 服务请求失败'), 502, classifiedCode, message);
  }
  return result;
}

export async function requestBuffer(url, { headers = {}, timeout = 120000, maxBytes = 200 * 1024 * 1024 } = {}) {
  let response;
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), redirect: 'follow' }); }
  catch (error) { throw new AppError('素材下载失败', 502, 'MEDIA_DOWNLOAD_FAILED', error.message); }
  if (!response.ok) throw new AppError('素材下载失败', 502, 'MEDIA_DOWNLOAD_FAILED', `HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > maxBytes) throw new AppError('素材超过本地上传大小限制', 413, 'MEDIA_TOO_LARGE');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maxBytes) throw new AppError('素材为空或超过大小限制', 413, 'MEDIA_TOO_LARGE');
  return { buffer, contentType: response.headers.get('content-type') || 'application/octet-stream' };
}