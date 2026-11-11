# ABOUT — AsciiDoc WYSIWYG Editor

Сводка по проекту после перехода на Tiptap-редактор (реализация `plans.md`).

---

## 1. Что это

**AsciiDoc WYSIWYG-редактор** — SPA с одной рабочей областью в стиле Confluence:

- **визуальный rich-text редактор** (Tiptap 3 / ProseMirror) с названием документа,
  sticky-тулбаром, bubble-меню по выделению, slash-меню и табличной панелью;
- **AsciiDoc-исходник** генерируется автоматически из модели документа и открывается
  read-only в той же области по кнопке «Исходник» (`Ctrl/Cmd + /`);
- **автосохранение** в `localStorage` и восстановление после перезагрузки;
- отдельная вкладка **«Сравнение AsciiDoc»** с прежним diff-просмотром.

Пользователь не пишет разметку руками: AsciiDoc собирается из ProseMirror JSON
функцией `serializeAsciiDoc(doc, title)`. Обратного импорта AsciiDoc в v1 нет.

---

## 2. Стек

| Категория | Технология | Версия |
|---|---|---|
| UI | React / React DOM | 19.2 |
| Сборка | Vite (Rolldown) | 8.2 |
| Язык | TypeScript | 7.0 |
| Компоненты/диалоги | MUI | 9.2 |
| Редактор | Tiptap (ProseMirror) | 3.33 |
| Подсветка исходника | highlight.js | 11.11 |
| Тесты | Vitest | 5.1 |
| Линт | ESLint 10 | — |

Tiptap-расширения: `StarterKit` (включает Link и Underline), `TableKit`,
`TaskList`/`TaskItem`, `Placeholder`, `CharacterCount`, `TextAlign`, `Highlight`,
`Superscript`, `Subscript` + собственное slash-меню на `@tiptap/suggestion`.

---

## 3. Структура

```
src/
├── app/App.tsx                     # вкладки: редактор + ленивый diff
├── main.tsx                        # createRoot + StrictMode
└── features/
    ├── editor/
    │   ├── editor/
    │   │   ├── extensions.ts       # конфигурация Tiptap
    │   │   ├── slash-command.ts    # Suggestion + команды блоков
    │   │   └── types.ts            # JSON-типы, статусы, режимы
    │   ├── model/
    │   │   ├── asciidoc/
    │   │   │   ├── escape.ts
    │   │   │   ├── serialize.ts
    │   │   │   └── serialize.test.ts
    │   │   ├── document.ts         # демо, localStorage, download/copy, имена файлов
    │   │   ├── useAsciiDocSource.ts# debounce 150 мс + requestIdleCallback
    │   │   └── useAutosave.ts      # debounce 500 мс
    │   └── ui/
    │       ├── EditorPage.tsx      # композиция экрана
    │       ├── EditorToolbar.tsx
    │       ├── EditorBubbleMenu.tsx
    │       ├── TableToolbar.tsx
    │       ├── LinkPopover.tsx
    │       ├── SlashMenu.tsx
    │       ├── SourceView.tsx
    │       ├── DocumentHeader.tsx
    │       ├── DocumentMenu.tsx
    │       ├── StatusBar.tsx
    │       ├── controls.tsx
    │       ├── icons.tsx
    │       └── editor.css
    └── asciidoc-diff/              # не изменялось
```

---

## 4. Поток данных

```
Tiptap Editor
   │ update (JSON)
   ├──► serializeAsciiDoc(json, title) ──debounce 150 мс──► source
   │                                                        │
   │                                                        └──► SourceView / download
   │
   └──► autosave {title, json} ──debounce 500 мс──► localStorage
```

- Единственный источник правды — документ Tiptap (ProseMirror JSON).
- Название документа хранится отдельно от тела: `= Название`, заголовки тела — `==…======`.
- Исходник при открытии панели генерируется сразу (`regenerate`), не ожидая debounce.
- `localStorage` ключ: `ascii-wysiwyg:document:v1`, формат `{ version, title, doc, savedAt }`.
- Ошибки квоты clipboard/storage обрабатываются без падения редактора.

---

## 5. Маппинг визуального документа → AsciiDoc

| Визуальный элемент | AsciiDoc |
|---|---|
| Название документа | `= Название` |
| Заголовки 1–5 | `==`, `===`, `====`, `=====`, `======` |
| Bold / italic / inline code | `**текст**` / `__текст__` / `` `код` `` |
| Underline / strike / highlight | `[.underline]#…#` / `[.line-through]#…#` / `[.highlight]#…#` |
| Sup / sub | `^текст^` / `~текст~` |
| Ссылка | `https://url[текст]`, `link:path[текст]`, `<<anchor,текст>>` |
| Маркированный / нумерованный список | `*` / `.`, вложенность `**` / `..` |
| Чек-лист | `* [ ]` / `* [x]` |
| Цитата | `[quote]` + `____ … ____` |
| Блок кода | `[source,lang]` + `---- … ----` (длина fence > самого длинного `-`) |
| Таблица | `[cols="1,1",options="header"]` + `\|=== … \|===` |
| Вложенная таблица | ячейка `a\|` + `!=== … !===` и ячейки `!` (глубже одного уровня — текстовая сводка) |
| Разделитель | `'''` |

Экранирование: `\|` в ячейках верхнего уровня, `!` в ячейках вложенной таблицы,
`\]` в тексте ссылки, `\\` для backslash,
блочные маркеры в начале строки (`*`, `.`, `-`, `=`, `\|`, `:`, `//`, `[`) — с учётом
того, что `**bold**` в начале абзаца не должно ломаться.

---

## 6. Команды

```bash
npm install
npm run dev        # Vite dev-сервер
npm run test       # 82 теста (сериализатор, вложенные таблицы, diff)
npm run typecheck  # tsc --noEmit
npm run build      # production-сборка
npm run lint       # eslint
```

---

## 7. Что проверено

| Проверка | Результат |
|---|---|
| `npm run test` | ✅ 11 файлов, 82 теста |
| `npm run typecheck` | ✅ без ошибок |
| `npm run build` | ✅ успешно; предупреждение Vite о размере чанка |
| Редактор в headless Chrome 1440×1100 | ✅ демо-документ, toolbar, статус-бар |
| Автосохранение | ✅ `localStorage` обновляется через 500 мс, статус «Сохранено в браузере» |
| Исходник | ✅ генерируется с заголовками, списками, таблицей, цитатой, кодом |
| Ссылки | ✅ добавление через popover, `Ctrl/Cmd + K`, удаление |
| Bubble-меню | ✅ появляется по выделению, форматирование применяется, скрывается по Esc |
| Таблицы | ✅ добавление/удаление строк и столбцов, заголовок, merge/split |
| Вложенные таблицы | ✅ `a\|` + `!===`; результат проверен через Asciidoctor |
| Slash-меню | ✅ открывается по `/`, фильтруется и вставляет блок |
| Новый документ | ✅ подтверждение, очистка, фокус на названии |
| Восстановление | ✅ пустой и демо-документ восстанавливаются после reload |
| Copy / download | ✅ «Скопировано»; `.adoc` скачивается и совпадает с исходником |
| Мобильная вёрстка 390 px | ✅ без горизонтального скролла, тулбар переносится |
| Вкладка diff | ✅ открывается, регрессий нет |
| Консоль | ✅ без ошибок в обычном сценарии |

Скриншоты: `docs/editor-preview.png`, `docs/editor-source-preview.png`,
`docs/editor-slash-preview.png`, `docs/editor-mobile-preview.png`,
`docs/editor-nested-table-preview.png`, `docs/editor-nested-table-source-preview.png`.

---

## 8. Отличия от исходного плана

- Slash-меню использует встроенное managed-позиционирование `@tiptap/suggestion`
  (Floating UI) вместо `tippy.js`: поведение то же, меньше зависимостей.
- `@tiptap/extension-link` и `underline` не устанавливались отдельно — в Tiptap 3
  они входят в `StarterKit`.
- Добавлены `Superscript`/`Subscript` (в плане были в маппинге, но отсутствовали
  в списке зависимостей).
- Выравнивание текста в ячейках таблицы не вынесено в панель (помечено в плане
  как «если успеваем»).

---

## 9. Ограничения и следующие шаги

Не входит в v1: открытие/сохранение `.adoc` через File System Access API,
импорт существующего AsciiDoc (Asciidoctor → HTML → Tiptap), редактируемый исходник,
изображения, admonitions, сноски/якоря, экспорт в HTML/PDF, совместная работа.

Технический долг: единый бандл редактора крупный (Tiptap + MUI); при необходимости —
code-split `EditorPage`. `eslint.config.js` по-прежнему проверяет только `js/jsx`;
для TS-файлов линт не настроен.
