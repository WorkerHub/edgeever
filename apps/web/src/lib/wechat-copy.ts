import type { Editor } from "@tiptap/react";
import { marked } from "marked";

const WECHAT_STYLES: Record<string, string> = {
  p: "margin: 0 0 1em; line-height: 1.75; font-size: 16px; color: #333;",
  h1: "margin: 1.2em 0 0.6em; font-size: 24px; line-height: 1.35; font-weight: 700; color: #1f2937;",
  h2: "margin: 1.1em 0 0.55em; font-size: 21px; line-height: 1.4; font-weight: 700; color: #1f2937;",
  h3: "margin: 1em 0 0.5em; font-size: 18px; line-height: 1.45; font-weight: 700; color: #1f2937;",
  blockquote: "margin: 1em 0; padding: 0.6em 1em; border-left: 4px solid #10b981; background: #f0fdf4; color: #4b5563; line-height: 1.75;",
  ul: "margin: 0 0 1em; padding-left: 1.6em; line-height: 1.75;",
  ol: "margin: 0 0 1em; padding-left: 1.6em; line-height: 1.75;",
  li: "margin: 0.25em 0; line-height: 1.75;",
  a: "color: #059669; text-decoration: underline;",
  strong: "font-weight: 700;",
  em: "font-style: italic;",
  del: "text-decoration: line-through;",
  code: "padding: 0.15em 0.35em; border-radius: 3px; background: #f3f4f6; color: #be123c; font-family: Menlo, Consolas, monospace; font-size: 0.9em;",
  pre: "margin: 1em 0; padding: 12px 14px; overflow: hidden; border-radius: 6px; background: #f6f8fa; color: #24292f; line-height: 1.6; text-align: left;",
  hr: "margin: 1.5em 0; border: 0; border-top: 1px solid #e5e7eb;",
  table: "width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 14px; line-height: 1.6;",
  th: "padding: 8px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 700; text-align: left;",
  td: "padding: 8px; border: 1px solid #d1d5db; text-align: left;",
  img: "display: block; max-width: 100%; height: auto; margin: 1em auto;",
};

const THEME_BLOCK_LABELS: Record<string, string> = {
  intro: "引言",
  "key-point": "重点观点",
  callout: "提示",
  chapter: "章节",
};

const THEME_BLOCK_STYLES: Record<string, { block: string; label: string }> = {
  intro: {
    block: "margin: 20px 0; padding: 0 0 4px; border-left: 5px solid #059669; background: #f0fdf4; color: #374151;",
    label: "padding: 10px 14px 0; color: #059669; font-size: 12px; font-weight: 700; letter-spacing: 1px;",
  },
  "key-point": {
    block: "margin: 20px 0; padding: 0 0 4px; border: 1px solid #a7f3d0; border-radius: 8px; background: #f0fdf4; color: #374151;",
    label: "padding: 10px 14px 0; color: #047857; font-size: 12px; font-weight: 700; letter-spacing: 1px;",
  },
  callout: {
    block: "margin: 20px 0; padding: 0 0 4px; border: 1px dashed #6ee7b7; background: #ecfdf5; color: #374151;",
    label: "padding: 10px 14px 0; color: #059669; font-size: 12px; font-weight: 700; letter-spacing: 1px;",
  },
  chapter: {
    block: "margin: 28px 0 16px; padding: 0 0 4px; border-top: 3px solid #059669; color: #111827;",
    label: "padding: 10px 0 0; color: #059669; font-size: 12px; font-weight: 700; letter-spacing: 2px;",
  },
};

const applyInlineStyles = (root: HTMLElement, editorTheme?: string) => {
  root.style.cssText = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.75; color: #333; word-break: break-word;";
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const style = WECHAT_STYLES[element.tagName.toLowerCase()];
    if (style) element.style.cssText = `${style}${element.style.cssText}`;
  });
  root.querySelectorAll<HTMLElement>("pre code").forEach((element) => {
    element.style.cssText = "padding: 0; background: transparent; color: inherit; font-family: Menlo, Consolas, monospace; font-size: 13px; white-space: pre-wrap;";
  });

  root.querySelectorAll<HTMLElement>("[data-edgeever-theme-block]").forEach((block) => {
    const kind = block.getAttribute("data-theme-block-kind") || "intro";
    const themeStyles = THEME_BLOCK_STYLES[kind] || THEME_BLOCK_STYLES.intro;
    const accent = editorTheme === "red-white" ? "#dc2626" : editorTheme === "olive-journal" ? "#ed7b2f" : editorTheme === "graphite-minimal" ? "#52525b" : "#059669";
    block.style.cssText = `${themeStyles.block} border-left-color: ${accent}; ${block.style.cssText}`;

    const label = document.createElement("p");
    label.textContent = THEME_BLOCK_LABELS[kind] || "主题组件";
    label.style.cssText = `${themeStyles.label} color: ${accent}; margin: 0;`;
    block.insertBefore(label, block.firstChild);
  });
};

export const buildWeChatClipboardHtml = (editor: Editor) => {
  const container = document.createElement("div");
  container.innerHTML = editor.getHTML();
  const editorTheme = editor.view.dom.closest<HTMLElement>("[data-editor-theme]")?.dataset.editorTheme;
  applyInlineStyles(container, editorTheme);
  return container.outerHTML;
};

const copyHtmlToClipboard = async (html: string, plainText: string) => {
  if (navigator.clipboard && "ClipboardItem" in window) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    })]);
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.style.cssText = "position: fixed; left: -99999px; top: 0;";
  container.innerHTML = html;
  document.body.appendChild(container);
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  if (!copied) throw new Error("Clipboard copy was not available");
};

export const copyEditorToWeChat = async (editor: Editor) =>
  copyHtmlToClipboard(buildWeChatClipboardHtml(editor), editor.getText({ blockSeparator: "\n" }));

export const copyMarkdownToWeChat = async (markdown: string) => {
  const container = document.createElement("div");
  container.innerHTML = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  applyInlineStyles(container);
  await copyHtmlToClipboard(container.outerHTML, container.textContent ?? "");
};
