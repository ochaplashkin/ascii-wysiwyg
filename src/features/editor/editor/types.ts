/** Structural subset of Tiptap/ProseMirror JSON used by the AsciiDoc serializer. */
export interface EditorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface EditorNode {
  type?: string;
  attrs?: Record<string, unknown> | undefined;
  content?: EditorNode[];
  marks?: EditorMark[];
  text?: string;
}
