import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { StreamLanguage } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { asciidoc } from 'codemirror-asciidoc';

export interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  /** File path used to remember the scroll position between files. */
  memoryKey: string;
  ariaLabel?: string;
  /** PlantUML sources use plain text highlighting. */
  language?: 'asciidoc' | 'plain';
}

/** Scroll offsets survive file switches because the editor is reused. */
const scrollMemory = new Map<string, number>();

/**
 * CodeMirror 6 wrapper. It is mounted imperatively because CodeMirror owns its
 * DOM; React only feeds the value and receives edits.
 */
export function CodeEditor({
  value,
  onChange,
  onSave,
  memoryKey,
  ariaLabel = 'AsciiDoc-исходник',
  language = 'asciidoc',
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRef = useRef(false);
  const keyRef = useRef(memoryKey);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          basicSetup,
          ...(language === 'asciidoc'
            ? [StreamLanguage.define(asciidoc)]
            : []),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          keymap.of([
            indentWithTab,
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current?.();
                return true;
              },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || applyingRef.current) return;
            onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    viewRef.current = view;

    const saved = scrollMemory.get(keyRef.current);
    if (saved !== undefined) {
      window.requestAnimationFrame(() => {
        if (viewRef.current === view) view.scrollDOM.scrollTop = saved;
      });
    }

    const rememberScroll = () => {
      scrollMemory.set(keyRef.current, view.scrollDOM.scrollTop);
    };
    view.scrollDOM.addEventListener('scroll', rememberScroll, {
      passive: true,
    });

    return () => {
      rememberScroll();
      view.scrollDOM.removeEventListener('scroll', rememberScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel, language]);

  // Remember the outgoing file's scroll offset, then restore the incoming one.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const previous = keyRef.current;
    if (previous === memoryKey) return;

    scrollMemory.set(previous, view.scrollDOM.scrollTop);
    keyRef.current = memoryKey;

    window.requestAnimationFrame(() => {
      if (viewRef.current !== view) return;
      view.scrollDOM.scrollTop = scrollMemory.get(memoryKey) ?? 0;
    });
  }, [memoryKey]);

  // Replace the document when the value comes from outside (file switch,
  // discard draft, undo visual edits). User edits do not trigger this branch.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === value) return;

    applyingRef.current = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
    applyingRef.current = false;
  }, [value]);

  return <div className="se-code" ref={containerRef} />;
}
