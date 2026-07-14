---
draft: false
title: "EdgeEver capability overview: Cloudflare self-hosting, Open API, and MCP"
snippet: "A current product overview based on the EdgeEver README, docs, and implementation structure."
image: {
    src: "/images/major-update.jpg",
    alt: "EdgeEver product capability overview"
}
publishDate: "2026-07-02 00:40"
category: "Product"
author: "EdgeEver Team"
tags: [updates, pwa, mcp, editor]
---

This article reflects the capabilities that are already explicit in the core repository. EdgeEver is an open source, self-hosted, Cloudflare-native notes workspace. It keeps the familiar three-column experience from classic Evernote-style tools while adding a REST API, OpenAPI schema, and Remote MCP endpoint.

The summary below is based on the README, documentation, and implementation structure in the core `edgeever` repository.

---

### 1. Classic three-column notes workspace

EdgeEver keeps a familiar workspace layout:

- Notebook tree
- Note list
- Main editor

It supports deeply nested notebooks, drag-and-drop notebook sorting and hierarchy changes, moving multiple notes, merging multiple notes, and rich text editing.

### 2. Open content model

EdgeEver stores content in three forms:

```text
content_json      TipTap/ProseMirror document, the editor's source of truth
content_markdown  API, Agent, import, and export format
content_text      Search, excerpt, and indexing format
```

This lets the web editor, REST API, MCP, import/export tooling, and search index each use the most suitable representation.

### 3. Cloudflare-native self-hosting

The current deployment target is a Cloudflare Worker:

- `/api/*` is handled by the Hono API
- Frontend static assets are served by Workers Assets
- D1 stores notebook, memo, memo content, and resource metadata
- R2 stores images and attachment objects

The core README gives a personal-use estimate of roughly 150,000 short notes or about 50,000 200 KB images. Actual usage and cost still depend on your Cloudflare account plan and Cloudflare's current pricing.

### 4. Browser-side image compression and PWA

Before upload, the web app can compress PNG, JPEG, WebP, and AVIF images locally in the browser, convert them to WebP, and limit the longest side to `2560px`. If the compressed file is not smaller than the original, EdgeEver keeps the original file. The server does not perform Cloudflare Images-style processing.

EdgeEver also supports PWA installation. The frontend uses Workbox and Dexie for offline drafts and a local sync queue.

### 5. REST API, OpenAPI, and MCP

EdgeEver provides:

- REST API
- `/api/openapi.json`
- Remote MCP endpoint
- CLI and MCP stdio bridge scripts

After creating an API token in the MCP settings card in the EdgeEver profile area, you can copy the token or the full MCP configuration and give it to an AI Agent so it can read and organize your notes.

### 6. Updating to the latest version

If you deployed from a fork:

1. Open your own EdgeEver fork on GitHub.
2. Click **Sync fork** on GitHub to sync the latest code from upstream.
3. If Cloudflare Workers Builds is connected, the push automatically builds, applies D1 migrations, and deploys. No local redeployment is needed.

For an older instance that is not yet connected to Workers Builds, complete the one-time [Workers Builds setup](/en/manual-deploy#enable-automatic-updates) before using **Sync fork** for future updates.
