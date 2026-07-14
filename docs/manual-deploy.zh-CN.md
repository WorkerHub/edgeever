# Cloudflare 手动部署指南

如果你熟悉 Cloudflare 和命令行，或者想自定义/精细控制首次安装与资源配置，可以按照以下指南进行手动部署。日常更新统一由 Cloudflare Workers Builds 完成；本地部署仅用于首次安装和紧急修复。

> 💡 **提示**：如果是通过 AI 助手（Claude Code、Codex、Antigravity、Cursor、Trae 等）进行部署，AI 助手应优先参考 [AI Agent Cloudflare Deployment](https://github.com/tianma-if/edgeever/blob/main/docs/agent-deploy-cloudflare.md) 约定。

## 部署步骤

1. **Fork 官方仓库**：
   访问并 Fork 官方仓库：[https://github.com/tianma-if/edgeever](https://github.com/tianma-if/edgeever)

2. **Clone 你的 Fork 仓库**：
   ```sh
   git clone <你的 Fork 仓库 URL>
   cd edgeever
   ```

3. **使用自动化辅助命令部署**：
   ```sh
   # 复制配置文件模板
   cp .env.local.example .env.local

   # 安装依赖
   bun install

   # 执行部署初始化，并设置首次登录密码
   EDGE_EVER_PASSWORD='<你的密码>' bun run deploy:setup

   # 诊断部署环境与配置
   bun run deploy:doctor

   # 执行部署
   bun run deploy
   ```

### 完全手动创建 Cloudflare 资源

如果你不想使用 `deploy:setup` 自动化脚本，也可以完全手动使用 Cloudflare CLI (Wrangler) 创建资源：

```sh
# 复制配置文件模板并安装依赖
cp .env.local.example .env.local
bun install

# 手动创建 D1 数据库
bunx wrangler d1 create edgeever

# 手动创建 R2 存储桶
bunx wrangler r2 bucket create edgeever-resources

# 生成密码 hash（用于后台验证）
bun run auth:hash -- <你的密码>

# 编辑 .env.local，至少填入刚创建的资源和密码配置
# EDGE_EVER_D1_DATABASE_ID=<D1 创建命令返回的 database_id>
# EDGE_EVER_R2_BUCKET_NAME=edgeever-resources
# EDGE_EVER_AUTH_PASSWORD_HASH=<上一步生成的 hash>
# EDGE_EVER_SESSION_TTL_DAYS=400

# 确认配置完整后再部署
bun run deploy:doctor
bun run deploy
```

必须在执行 `bun run deploy` **之前**，将 D1 创建命令返回的 `database_id`、R2 bucket 名称和生成的密码 hash 写入本机 `.env.local`。会话有效期建议保留模板中的 `400` 天；服务端也会把更大的值限制为 400 天。

`bun run deploy` 会构建 Web 应用、执行远程 D1 migration、部署 Worker，并将 `EDGE_EVER_AUTH_PASSWORD_HASH` 作为 Worker Secret 上传。部署脚本还会在成功后通过 `wrangler secret put` 再同步一次该 Secret，确保首次登录可用。部署完成后，请使用 `.env.local` 中的 `EDGE_EVER_AUTH_USERNAME` 和生成 hash 时使用的原始密码登录验证。

---

## 开启自动更新

首次部署后，必须将 Worker 连接到 Fork 的 `main` 分支；Cloudflare Workers Builds 是所有 EdgeEver 实例的标准生产发布路径。请先按 [Cloudflare Workers Builds 自动部署](cloudflare-workers-builds.zh-CN.md) 创建仅供配置使用的 **User API Token**（不是 Account API Token），将它私下写入 `.env.local` 的 `EDGE_EVER_BUILDS_API_TOKEN`，然后执行：

```sh
bun run deploy:builds:setup
```

该命令会配置 Git 仓库连接、生产触发器、构建变量和 D1 migration 所需的部署 token。完成后，只需在 Fork 页面点击 **Sync fork**，或推送到 `main`；Cloudflare 会自动构建 Web、应用新的远程 D1 migration 并发布 Worker。不需要 GitHub Actions Secrets，也不需要本地重新部署。

请保留 `bun run deploy` 作为首次安装和紧急修复的入口。
