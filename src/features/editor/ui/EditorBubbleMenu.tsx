import { useEffect, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeSelection } from '@tiptap/pm/state';

import { IconButton } from '../../../shared/ui/controls.js';

export interface EditorBubbleMenuProps {
  editor: Editor;
  onEditLink: () => void;
}

/** Compact dark panel that follows a text selection, like in Confluence. */
export function EditorBubbleMenu({
  editor,
  onEditLink,
}: EditorBubbleMenuProps) {
  const [dismissed, setDismissed] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
    }),
  });

  const range = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      from: current.state.selection.from,
      to: current.state.selection.to,
    }),
  });

  useEffect(() => {
    setDismissed(false);
  }, [range.from, range.to]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      className="editor-bubble-menu"
      aria-label="Форматирование выделения"
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ from, to, editor: current }) =>
        !dismissed &&
        from !== to &&
        // An atomic raw block is a NodeSelection; formatting marks do not
        // apply to it, so the bubble menu must stay hidden.
        !(current.state.selection instanceof NodeSelection)
      }
    >
      <IconButton
        icon="bold"
        label="Жирный"
        shortcut="Ctrl/Cmd + B"
        active={state.bold}
        compact
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <IconButton
        icon="italic"
        label="Курсив"
        shortcut="Ctrl/Cmd + I"
        active={state.italic}
        compact
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <IconButton
        icon="underline"
        label="Подчёркнутый"
        shortcut="Ctrl/Cmd + U"
        active={state.underline}
        compact
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <IconButton
        icon="strike"
        label="Зачёркнутый"
        active={state.strike}
        compact
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <IconButton
        icon="code"
        label="Инлайн-код"
        active={state.code}
        compact
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <span className="editor-bubble-menu__divider" aria-hidden="true" />
      <IconButton
        icon="link"
        label="Ссылка"
        shortcut="Ctrl/Cmd + K"
        active={state.link}
        compact
        onClick={onEditLink}
      />
      <IconButton
        icon="unlink"
        label="Удалить ссылку"
        compact
        disabled={!state.link}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
      <IconButton
        icon="clearFormat"
        label="Очистить форматирование"
        compact
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
      />
    </BubbleMenu>
  );
}
