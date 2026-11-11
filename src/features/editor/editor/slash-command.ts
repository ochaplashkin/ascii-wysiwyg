import { Extension } from '@tiptap/core';
import type { Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';
import {
  SlashMenu,
  type SlashItem,
  type SlashMenuHandle,
  type SlashMenuProps,
} from '../ui/SlashMenu.js';
import type { IconName } from '../../../shared/ui/icons.js';

type HeadingLevel = 1 | 2 | 3 | 4 | 5;

const HEADING_ICONS: Record<HeadingLevel, IconName> = {
  1: 'heading1',
  2: 'heading2',
  3: 'heading3',
  4: 'heading4',
  5: 'heading5',
};

function headingItem(level: HeadingLevel): SlashItem {
  return {
    id: `heading-${level}`,
    title: `Заголовок ${level}`,
    description:
      level === 1 ? 'Крупный раздел документа' : 'Подраздел документа',
    icon: HEADING_ICONS[level],
    keywords: ['heading', 'h', 'заголовок', 'раздел', String(level)],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level })
        .run();
    },
  };
}

const SLASH_ITEMS: SlashItem[] = [
  headingItem(1),
  headingItem(2),
  headingItem(3),
  headingItem(4),
  headingItem(5),
  {
    id: 'bullet-list',
    title: 'Маркированный список',
    description: 'Список с точками',
    icon: 'bulletList',
    keywords: ['bullet', 'ul', 'список', 'маркированный'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'ordered-list',
    title: 'Нумерованный список',
    description: 'Список с номерами',
    icon: 'orderedList',
    keywords: ['ordered', 'ol', 'список', 'нумерованный', 'цифры'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: 'task-list',
    title: 'Чек-лист',
    description: 'Список задач с флажками',
    icon: 'taskList',
    keywords: ['task', 'todo', 'чек', 'задачи', 'список'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: 'quote',
    title: 'Цитата',
    description: 'Выделенный блок цитаты',
    icon: 'quote',
    keywords: ['quote', 'blockquote', 'цитата'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: 'code-block',
    title: 'Блок кода',
    description: 'Моноширинный блок с языком',
    icon: 'codeBlock',
    keywords: ['code', 'код', 'source', 'листинг'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: 'table',
    title: 'Таблица',
    description: 'Таблица 3×2 с заголовком',
    icon: 'table',
    keywords: ['table', 'таблица', 'сетка'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
        .run();
    },
  },
  {
    id: 'divider',
    title: 'Разделитель',
    description: 'Горизонтальная линия',
    icon: 'divider',
    keywords: ['hr', 'divider', 'разделитель', 'линия'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

function filterItems(query: string): SlashItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return SLASH_ITEMS;
  }

  return SLASH_ITEMS.filter((item) =>
    [item.title, item.description, ...item.keywords].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

export interface SlashCommandOptions {
  items?: (props: { query: string; editor: Editor }) => SlashItem[];
}

/** Tiptap suggestion plugin that opens the block menu on "/". */
export function createSlashCommand(options: SlashCommandOptions = {}) {
  const getItems = options.items ?? (({ query }) => filterItems(query));

  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          allowSpaces: false,
          items: ({ query, editor }) => getItems({ query, editor }),
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          render: () => {
            let component: ReactRenderer<
              SlashMenuHandle,
              SlashMenuProps
            > | null = null;
            let unmount: (() => void) | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer<SlashMenuHandle, SlashMenuProps>(
                  SlashMenu,
                  {
                    editor: props.editor,
                    props: {
                      items: props.items,
                      command: props.command,
                      query: props.query,
                    },
                  },
                );

                unmount = props.mount(component.element);
              },

              onUpdate: (props) => {
                component?.updateProps({
                  items: props.items,
                  command: props.command,
                  query: props.query,
                });
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  return false;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                unmount?.();
                unmount = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}

