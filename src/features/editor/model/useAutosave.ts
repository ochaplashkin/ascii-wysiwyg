import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import type { SaveStatus } from '../editor/types.js';
import { saveStoredDocument } from './document.js';

const AUTOSAVE_DELAY = 500;

/**
 * Persist the document to localStorage after the user pauses typing.
 * Returns the current save indicator state.
 */
export function useAutosave(
  editor: Editor | null,
  title: string,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const editorRef = useRef<Editor | null>(editor);
  const titleRef = useRef(title);
  const timerRef = useRef<number | null>(null);
  const firstTitleEffect = useRef(true);

  const schedule = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setStatus('saving');
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const current = editorRef.current;
      if (!current) {
        return;
      }

      const saved = saveStoredDocument(titleRef.current, current.getJSON());
      setStatus(saved ? 'saved' : 'error');
    }, AUTOSAVE_DELAY);
  }, []);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    titleRef.current = title;

    if (!editorRef.current) {
      return;
    }

    if (firstTitleEffect.current) {
      firstTitleEffect.current = false;
      return;
    }

    schedule();
  }, [title, schedule]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const onUpdate = () => {
      schedule();
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [editor, schedule]);

  return status;
}
