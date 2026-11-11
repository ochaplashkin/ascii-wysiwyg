import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';

import { IconButton, ToolbarDivider } from '../../../shared/ui/controls.js';
import { TableIcon } from '../../../shared/ui/icons.js';

export interface TableToolbarProps {
  editor: Editor;
}

/** Contextual table actions shown while the cursor is inside a table. */
export function TableToolbar({ editor }: TableToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: current.isActive('table'),
      headerRow: current.isActive('tableHeader'),
      canMerge: current.can().mergeCells(),
      canSplit: current.can().splitCell(),
    }),
  });

  if (!state.active) {
    return null;
  }

  return (
    <div
      className="editor-table-toolbar"
      role="toolbar"
      aria-label="Действия с таблицей"
    >
      <span className="editor-table-toolbar__title">
        <TableIcon />
        Таблица
      </span>
      <ToolbarDivider />
      <IconButton
        icon="rowAbove"
        label="Добавить строку выше"
        compact
        onClick={() => editor.chain().focus().addRowBefore().run()}
      />
      <IconButton
        icon="rowBelow"
        label="Добавить строку ниже"
        compact
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <IconButton
        icon="columnLeft"
        label="Добавить столбец слева"
        compact
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />
      <IconButton
        icon="columnRight"
        label="Добавить столбец справа"
        compact
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <ToolbarDivider />
      <IconButton
        icon="headerRow"
        label="Заголовочная строка"
        compact
        active={state.headerRow}
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      />
      <IconButton
        icon="merge"
        label="Объединить ячейки"
        compact
        disabled={!state.canMerge}
        onClick={() => editor.chain().focus().mergeCells().run()}
      />
      <IconButton
        icon="split"
        label="Разделить ячейку"
        compact
        disabled={!state.canSplit}
        onClick={() => editor.chain().focus().splitCell().run()}
      />
      <ToolbarDivider />
      <IconButton
        icon="trash"
        label="Удалить строку"
        compact
        onClick={() => editor.chain().focus().deleteRow().run()}
      />
      <IconButton
        icon="trash"
        label="Удалить столбец"
        compact
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />
      <IconButton
        icon="trash"
        label="Удалить таблицу"
        compact
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </div>
  );
}
