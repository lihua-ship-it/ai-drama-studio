import fs from 'node:fs/promises';
import path from 'node:path';
import { app, prisma } from './app.js';
import { env } from './config/env.js';

// 本地开发启动入口；Vercel 部署由 api/index.mjs 直接使用导出的 app
await fs.mkdir(env.uploadDir, { recursive: true });
for (const folder of ['images', 'videos', 'audio']) await fs.mkdir(path.join(env.uploadDir, folder), { recursive: true });

const server = app.listen(env.port, () => console.log(`AI Drama API listening on http://localhost:${env.port}`));
if (!env.deepseekApiKey) console.error('DEEPSEEK_API_KEY is missing');
if (!env.volcengineApiKey) console.error('VOLCENGINE_API_KEY is missing');

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
