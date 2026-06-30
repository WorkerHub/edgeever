export type MigrationGuideCommand = {
  label: string;
  language: "sh" | "powershell";
  code: string;
};

export type MigrationGuideStep = {
  index: string;
  title: string;
  paragraphs?: string[];
  commands?: MigrationGuideCommand[];
  list?: string[];
};

export const EVERNOTE_MIGRATION_GUIDE = {
  title: "印象笔记迁移指引",
  subtitle: "支持 AI Agent 一键驱动或 MCP 自动化批量导入，保留笔记本组结构",
  introTitle: "最佳实践迁移方案",
  intro: [
    "我们强烈推荐使用 AI 编程助手（如 Antigravity、Claude Code、Cursor 等）自动执行迁移，或者基于 EdgeEver MCP (Model Context Protocol) 命令行进行迁移。该方案已完成内存流式优化与空文本预处理，能安全应对数 GB 级别超大笔记库，完整保留创建/修改时间与嵌套笔记本目录层级。",
  ],
  steps: [
    {
      index: "1",
      title: "第一步：配置 EdgeEver MCP 授权（获取 MCP Token）",
      list: [
        "登录你的 EdgeEver 网页端，点击左下角的「设置（Settings）」图标。",
        "在设置面板中找到「API & MCP 授权」卡片。",
        "点击「生成新 Token」，在输入框内填入 Token 用途（例如：Evernote Migration）。",
        "生成后复制该 Token 字符串（格式为 \`eev_...\`）。注意：Token 仅在生成时展示一次，请妥善保管。",
      ],
    },
    {
      index: "2",
      title: "第二步：把以下 Prompt 粘贴给 AI 编程助手（自动执行）",
      paragraphs: [
        "如果你正在使用 AI 编程助手（如 Antigravity、Claude Code、Cursor 等），直接复制下方精简 Prompt 发送给它，AI 将一键搞定全部工具安装与数据导入：",
      ],
      commands: [
        {
          label: "一键复制 Prompt 发送给 AI 助手",
          language: "sh",
          code: `你是 AI 编程助手。请帮我把本地的印象笔记全量迁移到我部署的 EdgeEver 实例中：
1. 检查本地是否安装了 \`evernote-backup\`。若未安装请使用 \`pipx install evernote-backup\` 自动安装。
2. 提示我输入印象笔记用户名密码并初始化数据库（指定 china 后端），随后同步数据并导出到 \`./evernote-export\` 目录。
3. 询问我当前 EdgeEver 的服务地址和先前在网页端生成的 MCP Token。
4. 运行内置导入脚本完成批量同步：
   \`EDGEEVER_URL="<地址>" EDGEEVER_TOKEN="<Token>" bun scripts/import-evernote-enex-via-mcp.mjs --input "./evernote-export" --yes\`

请向我确认所需的配置项（账号密码、Token、服务地址），收到后直接自动化并发执行上述步骤。`,
        },
      ],
      list: [
        "💡 手动模式备用：如果您不使用 AI 助手，具体执行命令在根目录 \`scripts/import-evernote-enex-via-mcp.mjs\` 的头部注释中有详细引导。",
      ],
    },
    {
      index: "3",
      title: "第三步：在网页端验证结果",
      list: [
        "导入完成后，回到 EdgeEver 网页端刷新页面。",
        "检查左侧栏，确认印象笔记原有的「笔记本组（堆叠）」和笔记本层级结构已完美还原。",
        "打开几篇包含多张图片的笔记，验证其中的图片是否已成功加载并能清晰显示。",
        "验证完毕后，你可以回到「设置」->「API & MCP 授权」中吊销此 Token 以保障安全。",
      ],
    },
  ] satisfies MigrationGuideStep[],
};
