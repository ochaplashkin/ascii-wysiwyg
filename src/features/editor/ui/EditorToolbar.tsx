import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';

import { IconButton, ToolbarDivider } from '../../../shared/ui/controls.js';
import { LinkPopover } from './LinkPopover.js';

export interface EditorToolbarProps {
  editor: Editor;
  linkOpen: boolean;
  onLinkOpen: () => void;
  onLinkClose: () => void;
}

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  headingLevel: number;
  canUndo: boolean;
  canRedo: boolean;
}

const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;

/** The main, always-visible formatting toolbar. */
export function EditorToolbar({
  editor,
  linkOpen,
  onLinkOpen,
  onLinkClose,
}: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }): ToolbarState => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      taskList: current.isActive('taskList'),
      blockquote: current.isActive('blockquote'),
      codeBlock: current.isActive('codeBlock'),
      headingLevel:
        HEADING_LEVELS.find((level) => current.isActive('heading', { level })) ??
        0,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const styleValue =
    state.headingLevel > 0 ? `h${state.headingLevel}` : 'paragraph';

  const changeStyle = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
      return;
    }

    const level = Number(value.slice(1));
    if (level >= 1 && level <= 5) {
      editor
        .chain()
        .focus()
        .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 })
        .run();
    }
  };

  return (
    <div
      className="editor-toolbar"
      role="toolbar"
      aria-label="Форматирование документа"
    >
      <div className="editor-toolbar__inner">
        <div className="editor-toolbar__group">
          <IconButton
            icon="undo"
            label="Отменить"
            shortcut="Ctrl/Cmd + Z"
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <IconButton
            icon="redo"
            label="Повторить"
            shortcut="Ctrl/Cmd + Shift + Z"
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>

        <ToolbarDivider />

        <div className="editor-toolbar__group">
          <label className="editor-style-select">
            <span className="editor-visually-hidden">Стиль абзаца</span>
            <select
              value={styleValue}
              onChange={(event) => changeStyle(event.target.value)}
              aria-label="Стиль абзаца"
              title="Стиль абзаца"
            >
              <option value="paragraph">Обычный текст</option>
              <option value="h1">Заголовок 1</option>
              <option value="h2">Заголовок 2</option>
              <option value="h3">Заголовок 3</option>
              <option value="h4">Заголовок 4</option>
              <option value="h5">Заголовок 5</option>
            </select>
          </label>
        </div>

        <ToolbarDivider />

        <div className="editor-toolbar__group">
          <IconButton
            icon="bold"
            label="Жирный"
            shortcut="Ctrl/Cmd + B"
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <IconButton
            icon="italic"
            label="Курсив"
            shortcut="Ctrl/Cmd + I"
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <IconButton
            icon="underline"
            label="Подчёркнутый"
            shortcut="Ctrl/Cmd + U"
            active={state.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <IconButton
            icon="strike"
            label="Зачёркнутый"
            shortcut="Ctrl/Cmd + Shift + S"
            active={state.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <IconButton
            icon="code"
            label="Инлайн-код"
            active={state.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
        </div>

        <div className="editor-toolbar__group editor-toolbar__group--link">
          <IconButton
            icon="link"
            label="Ссылка"
            shortcut="Ctrl/Cmd + K"
            active={state.link || linkOpen}
            onClick={onLinkOpen}
            aria-haspopup="dialog"
            aria-expanded={linkOpen}
          />
          <LinkPopover editor={editor} open={linkOpen} onClose={onLinkClose} />
        </div>

        <ToolbarDivider />

        <div className="editor-toolbar__group">
          <IconButton
            icon="bulletList"
            label="Маркированный список"
            shortcut="Ctrl/Cmd + Shift + 8"
            active={state.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <IconButton
            icon="orderedList"
            label="Нумерованный список"
            shortcut="Ctrl/Cmd + Shift + 7"
            active={state.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <IconButton
            icon="taskList"
            label="Чек-лист"
            shortcut="Ctrl/Cmd + Shift + 9"
            active={state.taskList}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          />
        </div>

        <ToolbarDivider />

        <div className="editor-toolbar__group">
          <IconButton
            icon="quote"
            label="Цитата"
            shortcut="Ctrl/Cmd + Shift + ."
            active={state.blockquote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <IconButton
            icon="codeBlock"
            label="Блок кода"
            shortcut="Ctrl/Cmd + Alt + C"
            active={state.codeBlock}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          <IconButton
            icon="divider"
            label="Разделитель"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <IconButton
            icon="table"
            label="Таблица 3×2"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
                .run()
            }
          />
        </div>

        <ToolbarDivider />

        <div className="editor-toolbar__group">
          <IconButton
            icon="clearFormat"
            label="Очистить форматирование"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          />
        </div>

      </div>
    </div>
  );
}
