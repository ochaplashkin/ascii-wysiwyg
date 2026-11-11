import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

export interface LinkPopoverProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}

function normalizeHref(value: string): string {
  const href = value.trim();
  if (href.length === 0) {
    return '';
  }

  if (
    href.startsWith('#') ||
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return href;
  }

  return `https://${href}`;
}

/** URL and label editor for the current selection / link mark. */
export function LinkPopover({ editor, open, onClose }: LinkPopoverProps) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [error, setError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const attrs = editor.getAttributes('link');
    const { from, to } = editor.state.selection;
    const currentText = editor.state.doc.textBetween(from, to, ' ');
    const href = typeof attrs.href === 'string' ? attrs.href : '';

    setUrl(href);
    setSelectedText(currentText);
    setLabel(currentText);
    setError('');
    window.requestAnimationFrame(() => urlRef.current?.focus());
  }, [open, editor]);

  if (!open) {
    return null;
  }

  const hasExistingLink = editor.isActive('link');

  const apply = () => {
    const href = normalizeHref(url);
    if (href.length === 0) {
      setError('Введите URL или якорь');
      return;
    }

    const { empty } = editor.state.selection;
    const nextLabel = label.trim();

    if (empty && hasExistingLink && nextLabel.length === 0) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    } else if (empty) {
      const text = nextLabel.length > 0 ? nextLabel : href;
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else if (nextLabel.length > 0 && nextLabel !== selectedText) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: nextLabel,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }

    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <div className="editor-link-popover" role="dialog" aria-label="Ссылка">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            editor.commands.focus();
          }
        }}
      >
        <label className="editor-link-popover__field">
          <span>URL</span>
          <input
            ref={urlRef}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com или #anchor"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="editor-link-popover__field">
          <span>Текст</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Текст ссылки"
            autoComplete="off"
          />
        </label>
        {error.length > 0 && (
          <p className="editor-link-popover__error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-link-popover__actions">
          <button type="submit" className="editor-button editor-button--primary">
            Применить
          </button>
          <button
            type="button"
            className="editor-button"
            onClick={remove}
            disabled={!hasExistingLink}
          >
            Удалить
          </button>
          <button
            type="button"
            className="editor-button editor-button--ghost"
            onClick={() => {
              onClose();
              editor.commands.focus();
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
