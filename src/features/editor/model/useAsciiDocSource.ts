import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import type { AsciiDocSource } from '../editor/types.js';
import { serializeAsciiDoc } from './asciidoc/serialize.js';

const SOURCE_DEBOUNCE = 150;

/**
 * Keep an up-to-date AsciiDoc rendering of the Tiptap document.
 *
 * Content changes are debounced and, when the browser supports it, generated
 * during idle time so typing stays responsive. `regenerate` forces a fresh
 * snapshot, e.g. when the source panel is opened.
 */
export function useAsciiDocSource(
  editor: Editor | null,
  title: string,
): AsciiDocSource {
  const [source, setSource] = useState('');
  const editorRef = useRef<Editor | null>(editor);
  const titleRef = useRef(title);
  const timerRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);
  const idleFallbackRef = useRef(false);
  const firstTitleEffect = useRef(true);

  const generate = useCallback(() => {
    const current = editorRef.current;
    if (!current) {
      setSource('');
      return;
    }

    setSource(serializeAsciiDoc(current.getJSON(), titleRef.current));
  }, []);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (idleRef.current !== null) {
      if (idleFallbackRef.current) {
        window.clearTimeout(idleRef.current);
      } else {
        window.cancelIdleCallback(idleRef.current);
      }
      idleRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancelPending();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;

      const run = () => {
        idleRef.current = null;
        generate();
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleFallbackRef.current = false;
        idleRef.current = window.requestIdleCallback(run, { timeout: 300 });
      } else {
        idleFallbackRef.current = true;
        idleRef.current = window.setTimeout(run, 0);
      }
    }, SOURCE_DEBOUNCE);
  }, [cancelPending, generate]);

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
      setSource('');
      return;
    }

    generate();
    const onUpdate = () => {
      schedule();
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      cancelPending();
    };
  }, [editor, generate, schedule, cancelPending]);

  const regenerate = useCallback(() => {
    cancelPending();
    generate();
  }, [cancelPending, generate]);

  return { source, regenerate };
}
