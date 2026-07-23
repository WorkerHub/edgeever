import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Lightbulb, MessageCircle, PanelTop, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const THEME_BLOCK_KINDS = ["intro", "key-point", "callout", "chapter"] as const;
export type ThemeBlockKind = (typeof THEME_BLOCK_KINDS)[number];

const kindIcon = {
  intro: MessageCircle,
  "key-point": Lightbulb,
  callout: PanelTop,
  chapter: PanelTop,
} satisfies Record<ThemeBlockKind, typeof MessageCircle>;

const ThemeBlockView = ({ node, deleteNode, selected }: NodeViewProps) => {
  const { t } = useTranslation();
  const kind = (node.attrs.kind as ThemeBlockKind) || "intro";
  const Icon = kindIcon[kind] ?? MessageCircle;

  return (
    <NodeViewWrapper
      className="edgeever-theme-block"
      data-theme-block-kind={kind}
      data-theme-block-selected={selected ? "true" : undefined}
    >
      <div className="edgeever-theme-block__toolbar" contentEditable={false}>
        <span className="edgeever-theme-block__label">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {t(`editorToolbar.themeBlocks.${kind}`)}
        </span>
        <button
          type="button"
          className="edgeever-theme-block__delete"
          aria-label={t("editorToolbar.deleteThemeBlock")}
          title={t("editorToolbar.deleteThemeBlock")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={deleteNode}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      <NodeViewContent className="edgeever-theme-block__content" />
    </NodeViewWrapper>
  );
};

export const ThemeBlock = Node.create({
  name: "edgeeverThemeBlock",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: "intro",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-theme-block-kind") || "intro",
        renderHTML: (attributes: { kind?: string }) => ({
          "data-theme-block-kind": attributes.kind || "intro",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-theme-block-kind]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-edgeever-theme-block": "true" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ThemeBlockView);
  },
});

export const insertThemeBlock = (editor: { chain: () => any; state: any }, kind: ThemeBlockKind) => {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, "\n", "\n").trim();

  editor
    .chain()
    .focus()
    .insertContentAt(
      { from, to },
      {
        type: "edgeeverThemeBlock",
        attrs: { kind },
        content: [{ type: "paragraph", content: selectedText ? [{ type: "text", text: selectedText }] : undefined }],
      }
    )
    .run();
};
