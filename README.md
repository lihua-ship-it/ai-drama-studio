# 幕间 · AI 短剧工作台

React + Vite 前端、Node.js + Express REST API、Prisma + SQLite。本地生成的图片、视频、音频分别保存在 `server/uploads/images`、`videos`、`audio`，通过 Express `/uploads` 提供播放和预览。DeepSeek、Seedream、Seedance、豆包 TTS 均由 Node 后端使用真实官方 API；浏览器不会收到任何密钥。

## 开发启动

1. 安装 Node.js 20 或更新版本。
2. 在本项目根目录运行 `npm install`。
3. 打开 `server/.env`，填写 `DEEPSEEK_API_KEY` 和 `VOLCENGINE_API_KEY` 两把 Key，再填写真实模型 ID。火山 Key 同时用于 Seedream、Seedance 和 TTS；兼容旧 `ARK_API_KEY` / `VOLCENGINE_ARK_API_KEY` 名称，但建议只设置统一的 `VOLCENGINE_API_KEY`。
4. 若要生成 Seedance 视频或使用人物参考图，把 `PUBLIC_BASE_URL` 配成一个指向本机 Express 3001 端口的真实 HTTPS 公网隧道/域名。方舟必须能访问传入的关键帧 URL；`localhost` 不能作为外部模型图片 URL。没有该公网地址时，文本生成和无参考图生图仍可用，Seedance 会返回 `PUBLIC_BASE_URL_MISSING`，不会伪造可访问地址。
5. 执行 `npm run db:generate`，再执行 `npm run db:migrate -- --name init` 初始化 Prisma/SQLite。
6. 根目录执行 `npm run dev`：Express API 在 `http://localhost:3001`，Vite 前端在 `http://localhost:5173`，浏览器打开后者。

首次连接空 SQLite 文件时，Prisma 需要运行迁移命令；迁移生成 `server/prisma/dev.db`。本地素材文件也不会提交到仓库。

## 服务端环境变量

`server/.env` 已创建空配置项，不包含示例/伪 Key：

- `DEEPSEEK_API_KEY`、可选 `DEEPSEEK_MODEL`（默认 `deepseek-flash`）
- `VOLCENGINE_API_KEY`：唯一火山引擎/豆包 Key；兼容 `ARK_API_KEY` 和 `VOLCENGINE_ARK_API_KEY` 别名。图片、视频、声音共用此 Key。
- `SEEDREAM_MODEL`、`SEEDANCE_MODEL`、`TTS_RESOURCE_ID`：控制台真实模型/资源 ID，不是密钥。
- `TTS_TEST_VOICE_ID`：可选，仅用于单句 TTS 连通性测试；正常生成仍使用人物表的 voiceId。
- 可选 `VOLCENGINE_TTS_URL`、`VOLCENGINE_ARK_BASE_URL`、`DEEPSEEK_BASE_URL`
- 可选 Seedance 测试输入 `SEEDANCE_TEST_IMAGE_URL`（必须是公网可访问的真实图片 URL）与 `SEEDANCE_TEST_TASK_ID`（必须是创建任务返回的真实 task_id）
- `PUBLIC_BASE_URL`：Seedance/参考图模型访问本地静态素材所需的真实 HTTPS 公网地址
- `DATABASE_URL`、`UPLOAD_DIR`、`PORT`、视频查询上限配置

请勿把 `server/.env` 内容放到 `client/`、浏览器环境变量或响应 JSON 中。`GET /api/health` 仅返回 DeepSeek/火山 Key 是否已配置，不返回 Key 值。缺配置时服务启动日志明确打印 `DEEPSEEK_API_KEY is missing` 或 `VOLCENGINE_API_KEY is missing`。

## 真实 API 单次测试

在项目根目录逐条运行，每条只发一个最小测试请求；这些测试会产生对应模型费用，不会批量生成素材：

```powershell
npm run test:provider --workspace server -- deepseek
npm run test:provider --workspace server -- seedream
npm run test:provider --workspace server -- seedance-create
npm run test:provider --workspace server -- seedance-status
npm run test:provider --workspace server -- tts
```

Seedance 创建测试需要 `SEEDANCE_TEST_IMAGE_URL` 指向真实、HTTPS 公网可读图片；创建成功后命令打印真实 `task_id`，将其临时填入 `SEEDANCE_TEST_TASK_ID` 再运行状态查询测试。TTS 测试需要 `TTS_TEST_VOICE_ID` 填一个控制台已授权音色。缺少这些值时测试会明确报配置缺失，不会发请求。

可逐个执行真实、单次模型连通测试，不会批量生成：

```powershell
npm run test:provider --workspace server -- deepseek
npm run test:provider --workspace server -- seedream
npm run test:provider --workspace server -- seedance-create
npm run test:provider --workspace server -- seedance-status
npm run test:provider --workspace server -- tts
```

Seedance 创建测试会真实产生一条至少 3 秒的视频任务并打印真实 task_id；将该值临时填入 `SEEDANCE_TEST_TASK_ID` 后运行状态测试。创建视频需准备 `SEEDANCE_TEST_IMAGE_URL` 公网图片地址。TTS 测试需填写一个已授权的 `TTS_TEST_VOICE_ID`。

火山错误会映射为 `API_KEY_INVALID`、`MODEL_PERMISSION_DENIED`、`INSUFFICIENT_BALANCE`、`QUOTA_EXHAUSTED` 或 `MODEL_NOT_AVAILABLE`，前端显示对应中文提示；不会静默切换模型。

## REST 与生成流程

- `POST/GET /api/projects`、`GET /api/projects/:projectId`
- `POST /api/projects/:projectId/story|characters|script|storyboard|image-prompts`
- `POST /api/projects/:projectId/assets/queue`、`POST /api/projects/tasks/:taskId/run|retry`
- `POST /api/characters/:characterId/image`、`POST /api/scenes/:sceneId/image`
- `POST /api/shots/:shotId/image|video|tts`
- `GET /api/shots/:shotId/video/status`

视频创建只保存 Seedance 返回的真实 `task_id`；状态页每 10 秒调用后端查询真实任务，最多 180 次。成功后后端下载模型素材到 `server/uploads` 并更新 SQLite。图片并发 2、视频并发 1、TTS 并发 1；失败任务最多自动重试 3 次，并可手动重试。

## 数据与目录

Prisma 表：`Project`、`Character`、`Episode`、`Scene`、`Shot`、`Asset`、`AiTask`。Prompt 位于 `server/prompts`；官方接口位于 `server/providers`；项目阶段编排与素材任务在 `server/services`；React 页面在 `client/src/pages`。