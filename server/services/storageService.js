import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { requestBuffer } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';

const MIME_EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav'
};

function safeSegment(value) {
  return String(value || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

export async function saveBuffer(kind, projectId, buffer, contentType, fallbackExtension) {
  const folder = ['images', 'videos', 'audio'].includes(kind) ? kind : 'images';
  const extension = MIME_EXTENSIONS[String(contentType).split(';')[0].trim().toLowerCase()] || fallbackExtension || 'bin';
  const directory = path.join(env.uploadDir, folder, safeSegment(projectId));
  await fs.mkdir(directory, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(directory, filename);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
  const filePath = `${folder}/${safeSegment(projectId)}/${filename}`;
  return { filePath, url: `/uploads/${filePath}`, absolutePath, size: buffer.length };
}

export async function saveRemote(kind, projectId, url, fallbackExtension) {
  if (!/^https:\/\//i.test(String(url || ''))) throw new AppError('上游素材 URL 无效', 502, 'INVALID_MEDIA_URL');
  const { buffer, contentType } = await requestBuffer(url, { maxBytes: env.maxMediaBytes });
  return saveBuffer(kind, projectId, buffer, contentType, fallbackExtension);
}

export function publicAssetUrl(filePath) {
  if (!env.publicBaseUrl) throw new AppError('Seedance 需要外部可访问的 PUBLIC_BASE_URL', 503, 'PUBLIC_BASE_URL_MISSING');
  const encoded = String(filePath).split('/').map(encodeURIComponent).join('/');
  return `${env.publicBaseUrl}/uploads/${encoded}`;
}

export function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}