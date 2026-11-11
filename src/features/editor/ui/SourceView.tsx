import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';
import asciidoc from 'highlight.js/lib/languages/asciidoc';

import 'highlight.js/styles/github.css';

import {
  copyTextToClipboard,
  downloadAsciiDoc,
} from '../model/document.js';
import { ArrowLeftIcon, CopyIcon, DownloadIcon } from './icons.js';

hljs.registerLanguage('asciidoc', asciidoc);

export interface SourceViewProps {
  source: string;
  title: string;
  onBack: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Read-only AsciiDoc source with syntax highlighting, copy and download. */
export function SourceView({ source, title, onBack }: SourceViewProps) {
  const codeRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    const node = codeRef.current;
    if (!node) {
      return;
    }

    node.innerHTML = hljs.highlight(source, { language: 'asciidoc' }).value;
  }, [source]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = async () => {
    const copied = await copyTextToClipboard(source);
    setCopyState(copied ? 'copied' : 'failed');

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setCopyState('idle'), 2200);
  };

  const lines = source.length === 0 ? 0 : source.split('\n').length;
  const characters = source.length;

  return (
    <section className="editor-source" aria-label="AsciiDoc-исходник">
      <header className="editor-source__header">
        <button type="button" className="editor-back-button" onClick={onBack}>
          <ArrowLeftIcon />
          <span>Вернуться к редактору</span>
          <kbd>Esc</kbd>
        </button>
        <div className="editor-source__titles">
          <h2 className="editor-source__title">
            AsciiDoc-исходник
            <span className="editor-badge editor-badge--muted">
              только просмотр
            </span>
          </h2>
          <p className="editor-source__subtitle">
            Генерируется автоматически из документа
          </p>
        </div>
        <div className="editor-source__actions">
          <button
            type="button"
            className="editor-button"
            onClick={copy}
            disabled={source.length === 0}
          >
            <CopyIcon />
            <span>
              {copyState === 'copied'
                ? 'Скопировано'
                : copyState === 'failed'
                  ? 'Не удалось'
                  : 'Копировать'}
            </span>
          </button>
          <button
            type="button"
            className="editor-button editor-button--primary"
            onClick={() => downloadAsciiDoc(title, source)}
          >
            <DownloadIcon />
            <span>Скачать .adoc</span>
          </button>
        </div>
      </header>

      {source.length > 0 ? (
        <pre className="editor-source__pre">
          <code ref={codeRef} className="hljs language-asciidoc" />
        </pre>
      ) : (
        <p className="editor-source__empty">
          Исходник пуст — в документе пока нет текста.
        </p>
      )}

      <footer className="editor-source__footer">
        <span>Строк: {lines}</span>
        <span>·</span>
        <span>Символов: {characters}</span>
        <span className="editor-source__footer-spacer" />
        <span className="editor-badge">AsciiDoc</span>
      </footer>
    </section>
  );
}
