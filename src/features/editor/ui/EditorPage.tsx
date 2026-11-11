import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';

import { createEditorExtensions } from '../editor/extensions.js';
import { createSlashCommand } from '../editor/slash-command.js';
import type { DocumentStats, EditorViewMode } from '../editor/types.js';
import {
  clearStoredDocument,
  createDemoDocument,
  createEmptyDocument,
  documentHasContent,
  downloadAsciiDoc,
  loadStoredDocument,
} from '../model/document.js';
import { serializeAsciiDoc } from '../model/asciidoc/serialize.js';
import { useAsciiDocSource } from '../model/useAsciiDocSource.js';
import { useAutosave } from '../model/useAutosave.js';
import { DocumentHeader } from './DocumentHeader.js';
import { EditorBubbleMenu } from './EditorBubbleMenu.js';
import { EditorToolbar } from './EditorToolbar.js';
import { SourceView } from './SourceView.js';
import { StatusBar } from './StatusBar.js';
import { TableToolbar } from './TableToolbar.js';
import './editor.css';

const EDITOR_EXTENSIONS = [...createEditorExtensions(), createSlashCommand()];

const EMPTY_STATS: DocumentStats = { words: 0, characters: 0 };

function getInitialDocument() {
  const stored = loadStoredDocument();
  if (stored) {
    return { title: stored.title, doc: stored.doc };
  }
  return createDemoDocument();
}

/** The single-area Confluence-style editor. */
export function EditorPage() {
  const [initialDocument] = useState(getInitialDocument);
  const [title, setTitle] = useState(initialDocument.title);
  const [viewMode, setViewMode] = useState<EditorViewMode>('editor');
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: initialDocument.doc,
    editorProps: {
      attributes: {
        class: 'tiptap-content',
        'aria-label': 'Область редактирования документа',
        spellcheck: 'true',
      },
    },
  });

  const saveStatus = useAutosave(editor, title);
  const { source, regenerate } = useAsciiDocSource(editor, title);

  const liveStats = useEditorState({
    editor,
    selector: ({ editor: current }): DocumentStats => {
      if (!current) {
        return EMPTY_STATS;
      }
      const counter = current.storage.characterCount as
        | { words: () => number; characters: () => number }
        | undefined;
      return {
        words: counter?.words() ?? 0,
        characters: counter?.characters() ?? 0,
      };
    },
  });
  const stats = liveStats ?? EMPTY_STATS;

  const openSource = useCallback(() => {
    regenerate();
    setLinkOpen(false);
    setViewMode('source');
  }, [regenerate]);

  const closeSource = useCallback(() => {
    setViewMode('editor');
    window.requestAnimationFrame(() => editor?.commands.focus());
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && event.key === '/') {
        event.preventDefault();
        if (viewMode === 'source') {
          closeSource();
        } else {
          openSource();
        }
        return;
      }

      if (mod && key === 'k' && viewMode === 'editor') {
        event.preventDefault();
        setLinkOpen(true);
        return;
      }

      if (event.key === 'Escape' && viewMode === 'source') {
        event.preventDefault();
        closeSource();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, openSource, closeSource]);

  useEffect(() => {
    if (!linkOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
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

  const resetDocument = useCallback(() => {
    clearStoredDocument();
    setTitle('');
    setViewMode('editor');
    setLinkOpen(false);
    editor?.commands.setContent(createEmptyDocument().doc, { emitUpdate: false });
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }, [editor]);

  const requestNewDocument = useCallback(() => {
    const hasContent =
      title.trim().length > 0 ||
      (editor ? documentHasContent(editor.getJSON()) : false);

    if (hasContent) {
      setConfirmNewOpen(true);
    } else {
      resetDocument();
    }
  }, [editor, resetDocument, title]);

  const handleDownload = useCallback(() => {
    const json = editor?.getJSON() ?? initialDocument.doc;
    downloadAsciiDoc(title, serializeAsciiDoc(json, title));
  }, [editor, initialDocument.doc, title]);

  const editing = viewMode === 'editor';

  return (
    <div className="editor-shell">
      {editor && (
        <div className="editor-topbar">
          <EditorToolbar
            editor={editor}
            linkOpen={linkOpen}
            onLinkOpen={() => setLinkOpen((current) => !current)}
            onLinkClose={() => setLinkOpen(false)}
            onOpenSource={openSource}
            onNewDocument={requestNewDocument}
            onDownload={handleDownload}
          />
          <TableToolbar editor={editor} />
        </div>
      )}

      <div className={`editor-workspace${editing ? '' : ' is-source'}`}>
        {editor && editing && (
          <article className="editor-page">
            <DocumentHeader
              title={title}
              onChange={setTitle}
              inputRef={titleInputRef}
            />
            <EditorContent editor={editor} className="editor-content" />
            <StatusBar stats={stats} saveStatus={saveStatus} />
          </article>
        )}

        {editor && !editing && (
          <SourceView source={source} title={title} onBack={closeSource} />
        )}

        {!editor && (
          <div className="editor-loading" role="status">
            Загрузка редактора…
          </div>
        )}
      </div>

      {editor && editing && (
        <EditorBubbleMenu
          editor={editor}
          onEditLink={() => setLinkOpen(true)}
        />
      )}

      <Dialog
        open={confirmNewOpen}
        onClose={() => setConfirmNewOpen(false)}
        aria-labelledby="new-document-title"
      >
        <DialogTitle id="new-document-title">
          Создать новый документ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Текущий документ будет очищен. Если хотите сохранить копию,
            скачайте её в формате .adoc.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmNewOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmNewOpen(false);
              resetDocument();
            }}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

    </div>
  );
}
