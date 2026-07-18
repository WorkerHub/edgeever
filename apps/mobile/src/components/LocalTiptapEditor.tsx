'use dom';

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TiptapDoc } from "@edgeever/shared";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { useCallback, useEffect, useRef, type Ref } from "react";

type EditorDoc = TiptapDoc;

type PickedImage = {
  alt: string;
  url: string;
};

export interface LocalTiptapEditorRef extends DOMImperativeFactory {
  flush: () => void;
  focus: () => void;
}

type LocalTiptapEditorProps = {
  baseUrl: string;
  content: EditorDoc;
  dom?: DOMProps;
  onChange: (content: EditorDoc) => Promise<void>;
  onPickImage: () => Promise<PickedImage | null>;
  onReady: (startupMs: number) => Promise<void>;
  ref: Ref<LocalTiptapEditorRef>;
  locale: "zh-CN" | "en-US";
  theme: "light" | "dark";
};

const CHANGE_IDLE_MS = 500;

export default function LocalTiptapEditor(props: LocalTiptapEditorProps) {
  const startedAtRef = useRef(performance.now());
  const changeTimerRef = useRef<number | null>(null);
  const onChangeRef = useRef(props.onChange);
  const onPickImageRef = useRef(props.onPickImage);
  const onReadyRef = useRef(props.onReady);

  onChangeRef.current = props.onChange;
  onPickImageRef.current = props.onPickImage;
  onReadyRef.current = props.onReady;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      Placeholder.configure({
        placeholder: props.locale === "en-US" ? "Start writing..." : "开始记录...",
      }),
    ],
    content: resolveImageSources(props.content, props.baseUrl),
    editorProps: {
      attributes: {
        autocapitalize: "sentences",
        autocomplete: "on",
        autocorrect: "on",
        class: "edgeever-editor-content",
        inputmode: "text",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
      }
      changeTimerRef.current = window.setTimeout(() => {
        changeTimerRef.current = null;
        void onChangeRef.current(normalizeImageSources(activeEditor.getJSON() as EditorDoc, props.baseUrl));
      }, CHANGE_IDLE_MS);
    },
  });

  const flush = useCallback(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    if (changeTimerRef.current !== null) {
      window.clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    void onChangeRef.current(normalizeImageSources(editor.getJSON() as EditorDoc, props.baseUrl));
  }, [editor, props.baseUrl]);

  useDOMImperativeHandle(
    props.ref,
    () => ({
      flush,
      focus: () => editor?.commands.focus(),
    }),
    [editor, flush]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    void onReadyRef.current(Math.round(performance.now() - startedAtRef.current));
    const handlePageHide = () => flush();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (changeTimerRef.current !== null) {
        window.clearTimeout(changeTimerRef.current);
      }
    };
  }, [editor, flush]);

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) =>
      (activeEditor?.isActive("bold") ? 1 : 0) |
      (activeEditor?.isActive("bulletList") ? 8 : 0) |
      (activeEditor?.isActive("blockquote") ? 16 : 0),
  });

  const insertImage = async () => {
    if (!editor) {
      return;
    }
    const image = await onPickImageRef.current();
    if (image) {
      editor.chain().focus().setImage({ alt: image.alt, src: resolveUrl(image.url, props.baseUrl) }).run();
    }
  };

  return (
    <div className="edgeever-editor-shell">
      <style>{getEditorStyles(props.theme)}</style>
      <div aria-label={props.locale === "en-US" ? "Editor toolbar" : "编辑器工具栏"} className="edgeever-editor-toolbar" role="toolbar">
        <ToolbarButton label={props.locale === "en-US" ? "Upload image" : "上传图片"} onRun={() => void insertImage()} text={props.locale === "en-US" ? "+ Image" : "＋图"} />
        <ToolbarButton active={Boolean(toolbarState & 1)} label={props.locale === "en-US" ? "Bold" : "加粗"} onRun={() => editor?.chain().focus().toggleBold().run()} text="B" />
        <ToolbarButton active={Boolean(toolbarState & 8)} label={props.locale === "en-US" ? "Bullet list" : "无序列表"} onRun={() => editor?.chain().focus().toggleBulletList().run()} text="•" />
        <ToolbarButton active={Boolean(toolbarState & 16)} label={props.locale === "en-US" ? "Quote" : "引用"} onRun={() => editor?.chain().focus().toggleBlockquote().run()} text="❝" />
        <ToolbarButton label={props.locale === "en-US" ? "Horizontal rule" : "分割线"} onRun={() => editor?.chain().focus().setHorizontalRule().run()} text="—" />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

const ToolbarButton = ({ active = false, label, onRun, text }: { active?: boolean; label: string; onRun: () => void; text: string }) => (
  <button
    aria-label={label}
    className={active ? "is-active" : undefined}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onRun}
    type="button"
  >
    {text}
  </button>
);

const mapImageSources = (doc: EditorDoc, mapSource: (source: string) => string): EditorDoc => {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const node = value as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]));
    if (node.type === "image" && next.attrs && typeof next.attrs === "object") {
      const attrs = next.attrs as Record<string, unknown>;
      if (typeof attrs.src === "string") {
        next.attrs = { ...attrs, src: mapSource(attrs.src) };
      }
    }
    return next;
  };

  return visit(doc) as EditorDoc;
};

const resolveImageSources = (doc: EditorDoc, baseUrl: string) => mapImageSources(doc, (source) => resolveUrl(source, baseUrl));

const normalizeImageSources = (doc: EditorDoc, baseUrl: string) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return mapImageSources(doc, (source) => source.startsWith(`${normalizedBaseUrl}/`) ? source.slice(normalizedBaseUrl.length) : source);
};

const resolveUrl = (source: string, baseUrl: string) => {
  if (!source.startsWith("/")) {
    return source;
  }
  return `${baseUrl.replace(/\/+$/, "")}${source}`;
};

const getEditorStyles = (theme: "light" | "dark") => `
  :root { color-scheme: ${theme}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  html, body, #root { width: 100%; height: 100%; margin: 0; background: ${theme === "dark" ? "#0f172a" : "#fff"}; }
  body { overflow: hidden; color: ${theme === "dark" ? "#f8fafc" : "#0f172a"}; }
  .edgeever-editor-shell { display: flex; height: 100%; min-height: 100%; flex-direction: column; background: ${theme === "dark" ? "#0f172a" : "#fff"}; }
  .edgeever-editor-toolbar { display: flex; flex: 0 0 auto; gap: 6px; overflow-x: auto; padding: 8px 10px; border-bottom: 1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}; background: ${theme === "dark" ? "#020617" : "#f8fafc"}; scrollbar-width: none; }
  .edgeever-editor-toolbar::-webkit-scrollbar { display: none; }
  .edgeever-editor-toolbar button { min-width: 38px; height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: ${theme === "dark" ? "#1e293b" : "#fff"}; color: ${theme === "dark" ? "#e2e8f0" : "#475569"}; font: inherit; font-size: 14px; font-weight: 700; box-shadow: inset 0 0 0 1px ${theme === "dark" ? "#475569" : "#e2e8f0"}; }
  .edgeever-editor-toolbar button.is-active { background: #ccfbf1; color: #0f766e; box-shadow: inset 0 0 0 1px #5eead4; }
  .tiptap { min-height: 100%; outline: none; }
  .edgeever-editor-shell > div:last-child { min-height: 0; flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .edgeever-editor-content { min-height: 100%; padding: 18px 18px 40vh; font-size: 17px; line-height: 1.7; word-break: break-word; caret-color: #0f766e; }
  .edgeever-editor-content > :first-child { margin-top: 0; }
  .edgeever-editor-content p.is-editor-empty:first-child::before { float: left; height: 0; color: #94a3b8; content: attr(data-placeholder); pointer-events: none; }
  .edgeever-editor-content h1, .edgeever-editor-content h2, .edgeever-editor-content h3 { line-height: 1.3; }
  .edgeever-editor-content blockquote { margin-left: 0; padding-left: 14px; border-left: 3px solid #5eead4; color: ${theme === "dark" ? "#cbd5e1" : "#475569"}; }
  .edgeever-editor-content pre { overflow-x: auto; border-radius: 10px; padding: 14px; background: #0f172a; color: #e2e8f0; }
  .edgeever-editor-content code { border-radius: 4px; padding: 2px 4px; background: ${theme === "dark" ? "#1e293b" : "#f1f5f9"}; }
  .edgeever-editor-content pre code { padding: 0; background: transparent; }
  .edgeever-editor-content img { display: block; max-width: 100%; height: auto; margin: 14px auto; border-radius: 10px; }
  .edgeever-editor-content hr { margin: 24px 0; border: 0; border-top: 1px solid #cbd5e1; }
`;
