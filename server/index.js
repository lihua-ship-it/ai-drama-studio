import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { aiConfigStatus, env } from './config/env.js';
import { prisma } from './db/prisma.js';
import projectsRouter from './routes/projects.js';
import mediaRouter from './routes/media.js';
import { AppError } from './utils/AppError.js';
import { publicProviderMessage } from './utils/providerErrors.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(env.uploadDir, { fallthrough: false, maxAge: '1h', immutable: false }));
app.get('/api/health', (request, response) => {
  const status = aiConfigStatus();
  response.json({ deepseek: status.deepseek ? 'configured' : 'missing', volcengine: status.volcengine ? 'configured' : 'missing' });
});
app.use('/api/projects', projectsRouter);
app.use('/api', mediaRouter);

app.use('/api', (request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API 路由不存在' } }));

const clientDist = path.resolve(serverDir, '../client/dist');
try {
  await fs.access(clientDist);
  app.use(express.static(clientDist));
  app.get('*', (request, response) => response.sendFile(path.join(clientDist, 'index.html')));
} catch {
  app.get('/', (request, response) => response.status(200).send('AI 短剧工作台 API 已运行。开发模式请打开 Vite 地址 localhost:5173。'));
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

await fs.mkdir(env.uploadDir, { recursive: true });
for (const folder of ['images', 'videos', 'audio']) await fs.mkdir(path.join(env.uploadDir, folder), { recursive: true });

const server = app.listen(env.port, () => console.log(`AI Drama API listening on http://localhost:${env.port}`));
const aiStatus = aiConfigStatus();
if (!aiStatus.deepseek) console.error('DEEPSEEK_API_KEY is missing');
if (!aiStatus.volcengine) console.error('VOLCENGINE_API_KEY is missing');

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);