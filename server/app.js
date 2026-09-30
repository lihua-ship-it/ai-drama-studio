import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import projectsRouter from './routes/projects.js';
import mediaRouter from './routes/media.js';
import { blobUrlFor } from './services/storageService.js';
import { AppError } from './utils/AppError.js';
import { publicProviderMessage } from './utils/providerErrors.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// /uploads/* 从 Vercel Blob 反查公网 URL 并 302 重定向（前端 /uploads/<path> 语义保持不变）
app.get('/uploads/*', async (request, response, next) => {
  try {
    const relative = request.path.replace(/^\/uploads\//, '');
    if (!relative) return next();
    const url = await blobUrlFor(relative);
    response.redirect(302, url);
  } catch (error) {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '素材不存在或已删除' } });
  }
});

app.get('/api/health', (request, response) => {
  response.json({ deepseek: Boolean(env.deepseekApiKey) ? 'configured' : 'missing', volcengine: Boolean(env.volcengineApiKey) ? 'configured' : 'missing' });
});
app.use('/api/projects', projectsRouter);
app.use('/api', mediaRouter);

app.use('/api', (request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API 路由不存在' } }));

// Vercel 上 express.static 不生效，前端静态资源由 outputDirectory(client/dist) 走 CDN；
// 仅在本地（非 VERCEL 环境）时挂载静态服务与 SPA 回退，避免 Serverless 环境多余的 fs 访问。
if (!process.env.VERCEL) {
  const clientDist = path.resolve(serverDir, '../client/dist');
  try {
    await fs.access(clientDist);
    app.use(express.static(clientDist));
    app.get('*', (request, response) => response.sendFile(path.join(clientDist, 'index.html')));
  } catch {
    app.get('/', (request, response) => response.status(200).send('AI 短剧工作台 API 已运行。开发模式请打开 Vite 地址 localhost:5173。'));
  }
}

app.use((error, request, response, next) => {
  console.error('HTTP request failed', { method: request.method, path: request.path, code: error.code, message: error.message, details: error.details || error.stack });
  if (response.headersSent) return next(error);
  const status = Number(error.status) || 500;
  response.status(status).json({ error: {
    code: error.code || 'INTERNAL_ERROR',
    message: ['CONFIG_MISSING', 'PUBLIC_BASE_URL_MISSING'].includes(error.code) || status < 500
      ? error.message
      : publicProviderMessage(error.code, '服务器处理失败，请查看后端日志')
  } });
});

export { prisma };
