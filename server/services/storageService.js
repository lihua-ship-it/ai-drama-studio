import crypto from 'node:crypto';
import { put, head } from '@vercel/blob';
import { env } from '../config/env.js';
import { requestBuffer } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';

const MIME_EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav'
};

// Vercel Blob 前缀命名空间，避免与前端 /uploads 静态路由冲突
const BLOB_PREFIX = 'media';

function safeSegment(value) {
  return String(value || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

/**
 * 保存二进制素材到 Vercel Blob。
 * 数据库仍存相对路径 filePath（images/<projectId>/<file>.jpg），
 * 前端 /uploads/* 与 Seedance 参考图 URL 都会经由该相对路径映射回 Blob 公网地址。
 */
export async function saveBuffer(kind, projectId, buffer, contentType, fallbackExtension) {
  const folder = ['images', 'videos', 'audio'].includes(kind) ? kind : 'images';
  const extension = MIME_EXTENSIONS[String(contentType).split(';')[0].trim().toLowerCase()] || fallbackExtension || 'bin';
  const projectSegment = safeSegment(projectId);
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = `${folder}/${projectSegment}/${filename}`;
  const pathname = `${BLOB_PREFIX}/${filePath}`;
  const blob = await put(pathname, buffer, { access: 'public', contentType, addRandomSuffix: false });
  return { filePath, url: blob.url, size: buffer.length };
}

export async function saveRemote(kind, projectId, url, fallbackExtension) {
  if (!/^https:\/\//i.test(String(url || ''))) throw new AppError('上游素材 URL 无效', 502, 'INVALID_MEDIA_URL');
  const { buffer, contentType } = await requestBuffer(url, { maxBytes: env.maxMediaBytes });
  return saveBuffer(kind, projectId, buffer, contentType, fallbackExtension);
}

/** 相对路径 -> Blob 公网 URL（用于 Seedance 参考图等需要外部可访问 URL 的场景） */
export async function blobUrlFor(filePath) {
  const blob = await head(`${BLOB_PREFIX}/${filePath}`);
  return blob.url;
}

/** 相对路径 -> Blob 公网直链（用于 Seedance / 参考图等需要外部模型直接抓取的场景）。
 *  注意：本函数自 v1.1 起由「同步」改为「异步」，直接返回 Blob 公网地址，
 *  不再经由 PUBLIC_BASE_URL + /uploads 的 302 中转（避免依赖第三方是否跟随重定向）。 */
export async function publicAssetUrl(filePath) {
  return blobUrlFor(filePath);
}

export function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}
