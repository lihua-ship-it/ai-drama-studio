# 部署运行手册（Runbook）— 幕间 · AI 短剧工作台 → Vercel

> 面向操作者，按顺序执行即可把代码变成**公网可访问网页**。预计 20–30 分钟。
> 前置：一个 GitHub 账号、一个 Vercel 账号（可用 GitHub 登录）、可用的 DeepSeek 与火山引擎 API Key。

---

## 步骤 0 · 本地准备

```bash
# 进入项目根目录
cd "C:/Users/survi/Desktop/AI视频工作流/项目/AI短剧生成器"

# 确认敏感文件不会被提交
git status                 # server/.env 不应出现在待提交列表

# 安装依赖 + 生成 Prisma Client + 本地构建前端
npm install
npm run db:generate
npm run build              # 产出 client/dist
```

---

## 步骤 1 · 推送代码到 GitHub

```bash
git add -A
git commit -m "chore: Vercel serverless deployment"
git push origin main
```

远端仓库：`https://github.com/lihua-ship-it/ai-drama-studio`（main 分支）。

---

## 步骤 2 · 在 Vercel 导入项目

1. 打开 https://vercel.com/new
2. **Import Git Repository** → 授权 GitHub → 选择 `ai-drama-studio`
3. **Configure Project**：
   - **Framework Preset**：`Vite`（或 `Other`，均无妨——`vercel.json` 已显式指定）
   - **Root Directory**：保持默认（仓库根 `.`）
   - **Build & Output Settings**：保持默认，`vercel.json` 会自动覆盖为
     - Build Command：`npm install && npm run db:generate && npm run db:migrate:deploy && npm run build`
     - Output Directory：`client/dist`
   - **Environment Variables**：先跳过，下一步单独配置（此时数据库/Blob 还没建）
4. 点 **Deploy**（首次可能因缺 `DATABASE_URL` 而在 `db:migrate:deploy` 阶段失败，属正常，先建库再 Redeploy）

---

## 步骤 3 · 创建 Postgres 数据库（Vercel Marketplace / Neon）

1. 进入 Vercel 项目 → 顶部 **Storage** 标签
2. **Create Database** → 选择 **Neon**（Postgres）
3. 按向导创建（Region 建议靠近主要用户；免费层即可）
4. 创建后 **Connect Project** → 选择当前项目 → 确认
5. 连接成功后，Vercel 会自动注入环境变量（无需手抄）：
   - `DATABASE_URL`（池化连接，运行时用）
   - `DATABASE_URL_UNPOOLED`（直连，`directUrl`/迁移用）

   > 可在 **Settings → Environment Variables** 里核对两者是否存在。

---

## 步骤 4 · 创建 Blob 存储

1. 项目 → **Storage** 标签 → **Create** → 选择 **Blob**
2. 创建后 **Connect Project** → 选择当前项目
3. 自动注入 `BLOB_READ_WRITE_TOKEN`（`@vercel/blob` 读取该变量）

---

## 步骤 5 · 配置环境变量

项目 → **Settings → Environment Variables**，逐条添加（Environment 勾选 **Production** 与 **Preview**）：

| 变量名 | 是否必填 | 值来源 / 说明 |
|--------|---------|--------------|
| `DEEPSEEK_API_KEY` | ✅ 必填 | 本地 `server/.env` 中的真实密钥 |
| `DEEPSEEK_MODEL` | ⚠️ 建议 | 默认 `deepseek-flash`，请核实为有效模型名（如 `deepseek-chat`） |
| `DEEPSEEK_BASE_URL` | 可选 | 默认 `https://api.deepseek.com` |
| `VOLCENGINE_API_KEY` | ✅ 必填 | 本地 `server/.env` 中的火山引擎密钥 |
| `VOLCENGINE_ARK_BASE_URL` | 可选 | 默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `SEEDREAM_MODEL` | ✅ 必填 | 本地 `server/.env` 中**目前为空**，必须补齐（负责生图） |
| `SEEDANCE_MODEL` | ✅ 必填 | 本地 `server/.env` 中**目前为空**，必须补齐（负责生视频） |
| `TTS_RESOURCE_ID` | ✅ 必填 | 本地 `server/.env` 中**目前为空**，必须补齐（负责配音） |
| `VOLC_TEXT_MODEL` | 可选 | 火山文本模型（如用到） |
| `DATABASE_URL` | 自动 | Neon 集成注入，勿手改 |
| `DATABASE_URL_UNPOOLED` | 自动 | Neon 集成注入，`directUrl` 使用 |
| `BLOB_READ_WRITE_TOKEN` | 自动 | Blob 集成注入 |
| `VIDEO_MAX_POLLS` / `VIDEO_POLL_INTERVAL_MS` | 可选 | 默认 `180` / `10000` |

> 说明：`PUBLIC_BASE_URL` 在本方案中**已退役**（改用 Blob 直链），无需配置。

---

## 步骤 6 · 触发部署

- 若步骤 2 已自动部署过：项目 → **Deployments** → 最新一次 → **Redeploy**（**必须**，让新环境变量生效）
- 之后每次 `git push` 到 main 会自动触发生产部署

---

## 步骤 7 · 验证

1. 打开生产地址 `https://<项目名>.vercel.app/`
   - 应看到「幕间 · AI 短剧工作台」首页
2. 健康检查：访问 `https://<项目名>.vercel.app/api/health`
   - 期望：`{"deepseek":"configured","volcengine":"configured"}`
3. 功能冒烟：
   - 首页 → 创建项目 → 生成「故事 / 人物」（DeepSeek，文本）
   - 生成一张人物图（Seedream → Blob）→ 页面能显示图片
   - 生成分镜视频（Seedance）→ 轮询到成功，能播放视频
4. 深链接回退：在浏览器直接打开 `https://<项目名>.vercel.app/project/<任意项目id>`
   - 期望：不 404，正常进入 SPA 页面

---

## 常见问题排查

| 现象 | 可能原因 | 处理 |
|------|---------|------|
| 构建报 `migrate deploy` provider 不匹配 | 旧 SQLite 迁移未清理 | 执行任务 T02：删除旧迁移目录 + `migration_lock.toml` 改 postgresql |
| 构建报 `prisma: command not found` | Vercel 未装 devDependencies | 把 `prisma` 从 `server` devDependencies 移到 dependencies 后重新部署 |
| 函数报 `Unable to find query engine` | binaryTargets 不匹配 | 确认 `binaryTargets = ["native","rhel-openssl-3.0.x"]` 并重新部署 |
| `/api/health` 返回 missing | 环境变量未配或未 Redeploy | 补变量后 Redeploy |
| 生图/生视频报 `CONFIG_MISSING` | `SEEDREAM_MODEL`/`SEEDANCE_MODEL`/`TTS_RESOURCE_ID` 为空 | 补齐这三个模型 ID |
| 深链接刷新 404 | SPA 回退 rewrite 缺失 | 检查 `vercel.json` 的兜底规则 `{ "source": "/(.*)", "destination": "/index.html" }` |
| 素材不显示 | Blob 未连接 / `/uploads` 302 失败 | 确认 Blob 已 Connect，`BLOB_READ_WRITE_TOKEN` 存在 |
| 长文本生成 504 | 超过函数时长上限 | 改用分集生成（`episodeNumber`），或降低重试次数 |

---

## 回滚

- Vercel → **Deployments** → 选历史成功部署 → **Promote to Production**（即时回滚）
- 数据侧：Neon 控制台支持时间点恢复（免费层能力有限，注意备份）

---

## 附录 · 路由优先级与 SPA 回退原理（已查证）

Vercel 官方「[Routing](https://vercel.com/docs/routing)」文档给出请求处理的**固定顺序**：

> Firewall → Microfrontends → Skew Protection → Rolling Releases → Bulk Redirects → Project Routes →
> **Deployment Routes**（`vercel.json`，其内部顺序为 **Headers + Redirects → Middleware → File System Routes → Rewrites**）

即：**文件系统（`outputDirectory` 中的真实静态文件）先于 `rewrites` 匹配**。因此本项目的 `vercel.json` 采用如下顺序敏感的规则，且兜底规则可以直接用宽泛的 `/(.*)`：

1. `/api/(.*)` → `/api/index`（进 Serverless 函数）
2. `/uploads/(.*)` → `/api/index`（进函数，302 到 Blob）
3. `/uploads` → `/api/index`
4. `/(.*)` → `/index.html`（SPA 深链接回退）

**为什么兜底用 `/(.*)` 不会被静态资源抢走请求**：像 `/assets/index-xxxx.js`、`/favicon.ico`、`/index.html` 这类**真实存在**的文件会在「File System Routes」阶段先被 CDN 命中并直接返回，根本不会走到「Rewrites」阶段的兜底规则；只有**未被文件系统匹配**的未知路径（如 `/project/<id>`）才会兜底回退到 `index.html`，交给前端 `BrowserRouter`。故无需使用 negative-lookahead 形式的兜底规则。
