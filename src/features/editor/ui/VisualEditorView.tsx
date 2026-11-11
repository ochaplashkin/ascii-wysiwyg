import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';

import { createEditorExtensions } from '../editor/extensions.js';
import { createSlashCommand } from '../editor/slash-command.js';
import type { EditorNode } from '../editor/types.js';
import type { LocalFile } from '../../workspace/model/directory-access.js';
import {
  parseAsciiDoc,
  type ImportWarning,
} from '../model/asciidoc/parse.js';
import { serializeAsciiDoc } from '../model/asciidoc/serialize.js';
import { DocumentHeader } from './DocumentHeader.js';
import { EditorBubbleMenu } from './EditorBubbleMenu.js';
import { EditorToolbar } from './EditorToolbar.js';
import { TableToolbar } from './TableToolbar.js';
import './editor.css';

const EDITOR_EXTENSIONS = [...createEditorExtensions(), createSlashCommand()];

/** First position inside a text block, so a leading raw atom is not selected. */
const firstTextPosition = (doc: ProseMirrorNode): number | null => {
  let position: number | null = null;

  doc.descendants((node, offset) => {
    if (position !== null) return false;
    if (node.isTextblock) {
      position = offset + 1;
      return false;
    }
    return true;
  });

  return position;
};

const countRawBlocks = (node: EditorNode): number => {
  if (node.type === 'rawAsciiDoc') return 1;
  return (node.content ?? []).reduce(
    (total, child) => total + countRawBlocks(child),
    0,
  );
};

export interface VisualEditorViewProps {
  /** Source as it was when the visual mode was entered. */
  initialSource: string;
  file: LocalFile;
  /** Receives the serialized AsciiDoc after every visual edit. */
  onChange: (source: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * Tiptap-based visual mode. The AsciiDoc source stays canonical: every update
 * is serialized back immediately (the draft autosave is debounced separately).
 *
 * Unknown markup is parsed into atomic `rawAsciiDoc` blocks, shown read-only
 * and written back verbatim by the serializer.
 */
export default function VisualEditorView({
  initialSource,
  file,
  onChange,
  onDirtyChange,
}: VisualEditorViewProps) {
  const [parsed] = useState(() => parseAsciiDoc(initialSource));
  const [title, setTitle] = useState(parsed.title);
  const [linkOpen, setLinkOpen] = useState(false);
  const [rawCount, setRawCount] = useState(() => countRawBlocks(parsed.doc));
  const [warnings] = useState<ImportWarning[]>(parsed.warnings);

  const titleRef = useRef(title);
  titleRef.current = title;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const dirtyRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const markDirty = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    onDirtyChangeRef.current(true);
  }, []);

  const emit = useCallback(() => {
    const current = editorRef.current;
    if (!current) return;
    const next = serializeAsciiDoc(
      current.getJSON() as unknown as EditorNode,
      titleRef.current,
    );
    onChangeRef.current(next);
  }, []);

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: parsed.doc,
    editorProps: {
      attributes: {
        class: 'tiptap-content',
        'aria-label': `Визуальное редактирование: ${file.name}`,
        spellcheck: 'true',
      },
    },
  });

  editorRef.current = editor;

  // A document that starts with a raw atom would otherwise open with a
  // NodeSelection and a highlighted non-editable block.
  useEffect(() => {
    if (!editor) return;
    if (!(editor.state.selection instanceof NodeSelection)) return;

    const position = firstTextPosition(editor.state.doc);
    if (position !== null) editor.commands.setTextSelection(position);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      markDirty();
      setRawCount(countRawBlocks(editor.getJSON() as unknown as EditorNode));
      emit();
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [editor, emit, markDirty]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setLinkOpen(true);
        return;
      }

      if (event.key === 'Escape') {
        setLinkOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!linkOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('.editor-link-popover') ||
        target.closest('[aria-label="Ссылка"]')
      ) {
        return;
      }
      setLinkOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [linkOpen]);

  const handleTitleChange = (next: string) => {
    setTitle(next);
    titleRef.current = next;
    markDirty();
    emit();
  };

  return (
    <div className="editor-shell ve-shell">
      {editor ? (
        <div className="editor-topbar">
          <EditorToolbar
            editor={editor}
            linkOpen={linkOpen}
            onLinkOpen={() => setLinkOpen((current) => !current)}
            onLinkClose={() => setLinkOpen(false)}
          />
          <TableToolbar editor={editor} />
        </div>
      ) : null}

      {rawCount > 0 ? (
        <div className="ve-banner" role="status">
          <span className="ve-banner__icon" aria-hidden="true">
            !
          </span>
          <div className="ve-banner__body">
            <strong>Часть разметки показана как исходник</strong>
            <p>
              Блоков с неподдерживаемой разметкой: {rawCount}. Это, например,{' '}
              <code>include::</code>, атрибуты, admonitions или изображения.
              Они видны как моноширинные блоки и сохраняются в AsciiDoc без
              изменений.
            </p>
            {warnings.length > 0 ? (
              <ul className="ve-banner__list">
                {warnings.slice(0, 3).map((warning, index) => (
                  <li key={`${warning.line}-${index}`}>
                    строка {warning.line}: {warning.preview}
                  </li>
                ))}
                {warnings.length > 3 ? (
                  <li>…и ещё {warnings.length - 3}</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="editor-workspace ve-workspace">
        {editor ? (
          <article className="editor-page ve-page">
            <DocumentHeader
              title={title}
              onChange={handleTitleChange}
              inputRef={titleInputRef}
            />
            <EditorContent editor={editor} className="editor-content" />
          </article>
        ) : (
          <div className="editor-loading" role="status">
            Загрузка визуального редактора…
          </div>
        )}
      </div>

      {editor ? (
        <EditorBubbleMenu
          editor={editor}
          onEditLink={() => setLinkOpen(true)}
        />
      ) : null}
    </div>
  );
}
