---
draft: false
title: "EdgeEver 当前能力概览：Cloudflare 自托管、开放 API 与 MCP"
snippet: "基于核心仓库 README、文档和代码同步整理 EdgeEver 当前已经实现的产品能力。"
image: {
    src: "/images/major-update.jpg",
    alt: "EdgeEver 产品能力概览"
}
publishDate: "2026-07-02 00:40"
category: "Product"
author: "EdgeEver Team"
tags: [updates, pwa, mcp, editor]
---

这篇文章同步核心仓库中已经明确存在的能力。EdgeEver 当前定位是：开源、自托管、Cloudflare-native 的现代笔记工作区，保留经典印象笔记的三栏体验，并提供 REST API、OpenAPI schema 和 Remote MCP endpoint。

以下内容来自同级 `edgeever` 核心仓库的 README、文档和实现结构。

---

### 1. 经典三栏笔记工作区

EdgeEver 保留熟悉的三栏布局：

- 笔记本树
- 笔记列表
- 主编辑区

它支持无限级嵌套笔记本、笔记本拖拽排序和调整层级、多选移动笔记、多选合并笔记，以及富文本编辑。

### 2. 开放内容模型

EdgeEver 同时保存三种内容形态：

```text
content_json      TipTap/ProseMirror 文档，编辑器权威格式
content_markdown  API、Agent、导入导出使用
content_text      搜索、摘要和索引使用
```

这样的设计让前端编辑器、REST API、MCP、导入导出和搜索索引可以各自使用合适的数据形态。

### 3. Cloudflare-native 自托管

当前部署形态是一个 Cloudflare Worker：

- `/api/*` 由 Hono API 处理
- 前端静态资源由 Workers Assets 提供
- D1 保存 notebooks、memos、memo_contents、resources 元数据等
- R2 保存图片和附件对象

核心 README 中给出的个人使用估算是：短笔记可达 15 万条，200KB 图片约可存放 5 万张。实际用量和费用仍以 Cloudflare 账号计划与官方定价为准。

### 4. Web 端图片压缩与 PWA

网页端上传图片前，可以在浏览器本地把 PNG、JPEG、WebP、AVIF 尝试压缩为 WebP，并将最长边限制在 `2560px` 以内。如果压缩结果不比原图小，则保留原图。服务端不会额外执行 Cloudflare Images 式处理。

EdgeEver 也支持 PWA 安装，前端使用 Workbox 和 Dexie 支撑离线草稿与本地同步队列。

### 5. REST API、OpenAPI 与 MCP

EdgeEver 提供：

- REST API
- `/api/openapi.json`
- Remote MCP endpoint
- CLI 与 MCP stdio bridge 脚本

在 EdgeEver 左下角个人中心的 MCP 设置里创建 API Token 后，可以复制 Token 或完整 MCP 配置交给 AI Agent，让它读取和整理你的笔记。

### 6. 更新到最新版

如果你是通过 Fork 部署的：

1. 打开你自己的 EdgeEver Fork 仓库。
2. 点击 GitHub 页面上的 **Sync fork**，同步官方仓库的最新代码。
3. 已配置 Cloudflare Workers Builds 时，产生的 push 会自动构建、执行 D1 migration 并发布，无需回到本地重新部署。

如果是较早安装的实例、尚未连接 Workers Builds，请先按 [Cloudflare Workers Builds 自动部署](/manual-deploy#开启自动更新) 完成一次连接；之后再使用 **Sync fork** 更新。
