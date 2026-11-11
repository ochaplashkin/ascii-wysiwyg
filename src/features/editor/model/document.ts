import type { EditorDocument, EditorNode } from '../editor/types.js';

export const STORAGE_KEY = 'ascii-wysiwyg:document:v1';
export const STORAGE_VERSION = 1;

export interface StoredDocument {
  version: typeof STORAGE_VERSION;
  title: string;
  doc: EditorNode;
  savedAt: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const text = (value: string, marks?: EditorNode['marks']): EditorNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});

const paragraph = (...content: EditorNode[]): EditorNode => ({
  type: 'paragraph',
  content,
});

const heading = (level: number, value: string): EditorNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

const tableCell = (
  value: string,
  type: 'tableHeader' | 'tableCell' = 'tableCell',
): EditorNode => ({
  type,
  content: [paragraph(text(value))],
});

const tableRow = (...cells: EditorNode[]): EditorNode => ({
  type: 'tableRow',
  content: cells,
});

const listItem = (...content: EditorNode[]): EditorNode => ({
  type: 'listItem',
  content,
});

const taskItem = (checked: boolean, value: string): EditorNode => ({
  type: 'taskItem',
  attrs: { checked },
  content: [paragraph(text(value))],
});

export const DEMO_TITLE = 'Мой документ';

/** Starter document shown on the first visit. */
export function createDemoDocument(): EditorDocument {
  return {
    title: DEMO_TITLE,
    doc: {
      type: 'doc',
      content: [
        heading(1, 'О проекте'),
        paragraph(
          text('Это '),
          text('WYSIWYG', [{ type: 'bold' }]),
          text('-редактор AsciiDoc в стиле Confluence. Исходник генерируется автоматически из документа и доступен по кнопке «Исходник».'),
        ),
        paragraph(
          text('Больше о синтаксисе — на '),
          text('сайте AsciiDoc', [
            { type: 'link', attrs: { href: 'https://asciidoc.org' } },
          ]),
          text('.'),
        ),
        heading(2, 'Возможности'),
        {
          type: 'bulletList',
          content: [
            listItem(paragraph(text('Заголовки, абзацы и инлайн-форматирование'))),
            listItem(
              paragraph(text('Ссылки, списки и чек-листы')),
              {
                type: 'bulletList',
                content: [
                  listItem(paragraph(text('Вложенные пункты'))),
                  listItem(paragraph(text('Горячие клавиши и slash-меню'))),
                ],
              },
            ),
            listItem(paragraph(text('Таблицы с заголовком и объединением ячеек'))),
          ],
        },
        heading(2, 'План работы'),
        {
          type: 'taskList',
          content: [
            taskItem(true, 'Спроектировать визуальный редактор'),
            taskItem(true, 'Подключить сериализатор AsciiDoc'),
            taskItem(false, 'Проверить адаптивность на 390 px'),
          ],
        },
        heading(2, 'Сравнение'),
        {
          type: 'table',
          content: [
            tableRow(
              tableCell('Параметр', 'tableHeader'),
              tableCell('Значение', 'tableHeader'),
              tableCell('Готово', 'tableHeader'),
            ),
            tableRow(
              tableCell('Редактор'),
              tableCell('Tiptap (ProseMirror)'),
              tableCell('Да'),
            ),
            tableRow(
              tableCell('Исходник'),
              tableCell('AsciiDoc'),
              tableCell('Да'),
            ),
            tableRow(
              tableCell('Хранение'),
              tableCell('localStorage'),
              tableCell('Да'),
            ),
          ],
        },
        {
          type: 'blockquote',
          content: [
            paragraph(
              text('Визуальный документ — единственный источник правды. AsciiDoc собирается из модели, а не из HTML.'),
            ),
          ],
        },
        heading(2, 'Пример кода'),
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [
            text('const source = serializeAsciiDoc(editor.getJSON(), title);'),
          ],
        },
        { type: 'horizontalRule' },
        paragraph(
          text('Документ хранится только в этом браузере.', [
            { type: 'italic' },
          ]),
        ),
      ],
    },
  };
}

export function createEmptyDocument(): EditorDocument {
  return {
    title: '',
    doc: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  };
}

function safeStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isStoredDocument(value: unknown): value is StoredDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === STORAGE_VERSION &&
    typeof value.title === 'string' &&
    typeof value.savedAt === 'string' &&
    isRecord(value.doc) &&
    value.doc.type === 'doc' &&
    Array.isArray(value.doc.content)
  );
}

export function loadStoredDocument(
  storage: StorageLike | null = safeStorage(),
): StoredDocument | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isStoredDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredDocument(
  title: string,
  doc: EditorNode,
  storage: StorageLike | null = safeStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  const stored: StoredDocument = {
    version: STORAGE_VERSION,
    title,
    doc,
    savedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredDocument(
  storage: StorageLike | null = safeStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures: the editor keeps working in memory.
  }
}

/** True when the document has text or structural blocks worth keeping. */
export function documentHasContent(doc: EditorNode): boolean {
  if (typeof doc.text === 'string' && doc.text.trim().length > 0) {
    return true;
  }

  if (doc.type === 'table' || doc.type === 'horizontalRule' || doc.type === 'codeBlock') {
    return true;
  }

  return (doc.content ?? []).some((child) => documentHasContent(child));
}

export function asciiDocFileName(title: string): string {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 80)
    .trim();

  return `${base.length > 0 ? base : 'document'}.adoc`;
}

export function downloadAsciiDoc(title: string, source: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }

  const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = asciiDocFileName(title);
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Clipboard write with a textarea fallback for older browsers. */
export async function copyTextToClipboard(source: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(source);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = source;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export function getSaveStatusLabel(
  status: 'saved' | 'saving' | 'error',
): string {
  switch (status) {
    case 'saving':
      return 'Сохранение…';
    case 'error':
      return 'Не удалось сохранить локально';
    default:
      return 'Сохранено в браузере';
  }
}
