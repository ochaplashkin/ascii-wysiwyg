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

export interface EditorDocument {
  title: string;
  doc: EditorNode;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export type EditorViewMode = 'editor' | 'source';

export interface DocumentStats {
  words: number;
  characters: number;
}

export interface AsciiDocSource {
  source: string;
  regenerate: () => void;
}
