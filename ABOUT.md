# ABOUT — AsciiDoc WYSIWYG Editor

Сводка знаний о проекте: что это, как устроено, как запускать, что проверено и какие дефекты найдены.
Составлено по состоянию ветки `main` (`2f9b13a`, working tree clean), зависимости установлены.

---

## 1. Что это

**AsciiDoc WYSIWYG-редактор** — SPA с двумя колонками:

- **слева** — визуальный rich-text редактор (Quill 2) с тулбаром: заголовки 1–3, bold/italic/underline/strike, ссылка, цитата, таблица;
- **справа** — выпадающий список темы подсветки и живой предпросмотр сгенерированной **AsciiDoc**-разметки с подсветкой синтаксиса (`highlight.js`, язык `asciidoc`).

Ключевая идея: пользователь не пишет разметку руками — она выводится из HTML редактора на лету, при каждом изменении текста.

Ограничения текущего состояния:

- обратное преобразование (AsciiDoc → документ) отсутствует;
- сохранения/загрузки файлов, экспорта и «настоящего» рендера AsciiDoc в HTML нет;
- документ живёт только в состоянии React (перезагрузка страницы его теряет).

---

## 2. Стек

| Категория | Технология | Версия |
|---|---|---|
| UI | React / React DOM | 19.2 |
| Сборка | Vite (Rolldown) | 8.2 |
| Язык | TypeScript | 7.0 (только `.ts/.tsx`) |
| Компоненты/стили | MUI | 9.2 |
| Редактор | Quill | 2.0.2 |
| Таблицы в редакторе | quill-table-better | 1.2.3 |
| Подсветка | highlight.js | 11.11 |
| Линт | ESLint 10 + react-hooks + react-refresh | — |

Runtime для проверок: Node 24.18.1, npm 12.0.2.

---

## 3. Структура и роли файлов

```
ascii-wysiwyg/
├── index.html                  # точка входа, <title>my-react-app</title>
├── vite.config.js              # только плагин react
├── tsconfig.json               # strict, module: nodenext, allowJs отсутствует
├── global.d.ts                 # declares для '*?raw' и '*.css'
├── eslint.config.js            # проверяет ТОЛЬКО **/*.{js,jsx}
├── docs/
│   ├── preview.png             # скриншот интерфейса для README
│   └── visual-to-ascii.template# шпаргалка соответствия блоков и пример таблицы
├── public/                     # favicon.svg, icons.svg (не используется)
└── src/
    ├── main.jsx                # createRoot + StrictMode
    ├── app/App.jsx             # состояние + вся логика HTML→AsciiDoc
    ├── app/App.css             # мёртвый код (никуда не импортируется)
    ├── assets/                 # hero.png, react.svg, vite.svg — не используются
    ├── pages/WorkareaPage.tsx  # двухколоночный layout на MUI Box/Container
    └── widgets/
        ├── editor/Editor.tsx        # обёртка Quill, forwardRef, регистрация table-better
        ├── editor/styles.css        # стили .controls/.state и цвет ql-syntax
        ├── highlighter/Highlighter.tsx # hljs.highlightElement + инжект CSS темы
        ├── highlighter/ThemePicker.tsx # <select> тем
        └── highlighter/themes.ts       # ['github', 'githubdark']
```

Структура в духе FSD (`app / pages / widgets`), но с остатками шаблона Vite и без слоя `features`, где логике конвертации было бы место.

---

## 4. Поток данных

```
пользователь печатает
  → Editor (Quill) emit TEXT_CHANGE
    → App.handleTextChange
      → quillRef.current.getSemanticHTML()      // семантический HTML Quill 2
        → processHMTLtoASCII(html)              // цепочка replaceAll + таблицы/ссылки
          → setSourceCode(asciidoc)
            → <Highlighter source={source} theme={theme}/>
              → hljs.highlightElement(<code class="asciidoc">)
```

Дополнительно: `Highlighter` инжектит CSS выбранной темы через `<style>{github | githubdark}</style>`, импортируя стили как строки: `import github from 'highlight.js/styles/github.css?raw'`.

Подписка на изменения: `Editor` пробрасывает `onTextChange`/`onSelectionChange` через ref-обёртки (актуальные колбэки всегда в `useRef`), сам Quill создаётся один раз в `useEffect` с зависимостью `[ref]`.

---

## 5. Как запускать

```bash
npm install          # зависимости уже установлены
npm run dev          # Vite dev-сервер
npm run build        # прод-сборка в dist/ (~1.6 МБ, чанк 1.63 МБ / 523 КБ gzip)
npm run preview      # предпросмотр сборки
npm run lint         # eslint (сейчас падает, см. §7)
npx tsc --noEmit     # типы (сейчас проходит, но покрытие неполное)
```

**Важно:** dev-сервер на этом окружении слушает только IPv6-loopback — `http://127.0.0.1:PORT` не отвечает, а `http://localhost:PORT` и `http://[::1]:PORT` работают. Если нужен `127.0.0.1`, запускать с `--host 127.0.0.1`.

Тестов и CI в проекте нет.

---

## 6. Что фактически проверено

| Проверка | Результат |
|---|---|
| `npm run build` | ✅ успешно, 1816 модулей, 522 мс, предупреждение о размере чанка >500 КБ |
| dev-сервер + headless Chrome (1440×900) | ✅ приложение рендерится: тулбар, две колонки, подсветка `== Test` справа |
| `npx tsc --noEmit` | ✅ без ошибок, но только 6 файлов: `App.jsx`/`main.jsx` вне проверки |
| `npx eslint .` | ❌ 11 ошибок `no-unused-vars` |
| Поведение конвертера (харнесс в браузере) | ⚠️ подтверждены 7 дефектов, см. §7.1 |
| Глубина покрытия типами | частичная: интерфейсы `Editor`/`Highlighter` типизированы, но `App.jsx` — обычный JS с `any` |

Замечание по типизации: `tsconfig.json` не содержит `allowJs`, поэтому `.jsx`-файлы не проверяются вообще; типы описывают лишь `Editor`, `Highlighter`, `ThemePicker`, `WorkareaPage`.

---

## 7. Найденные дефекты

### 7.1 Конвертер HTML → AsciiDoc (`src/app/App.jsx`)

Реализован как последовательность `replaceAll` по «сырому» HTML плюс две ad-hoc функции (`parseAnchor`, `tableToAsciidoc`). Автор сам помечает код как «too bad design, MUST be rewriting later».

Воспроизведено в браузере на реальных входах:

| # | Кейс | Вход | Фактический результат | Ожидание |
|---|---|---|---|---|
| 1 | Несколько ссылок | `<a href="a">A</a> … <a href="b">B</a>` | `https://a.com[A] … https://a.com[A]` | `a[A] … b[B]` |
| 2 | Ссылка с форматированием | `<a href="a"><strong>A</strong></a>` | сырой HTML | `a[A]` (с `**A**`) |
| 3 | Несколько таблиц | две `<table>` | вторая заменена копией первой | обе таблицы конвертированы |
| 4 | Символ `\|` в ячейке | `<td>a\|b</td>` | структура таблицы ломается (лишний разделитель) | экранирование символа `\|` |
| 5 | Заголовки h4–h6 | `<h4>…</h4>` | сырой HTML | `==== …` |
| 6 | Списки, `<code>`, `<pre>`, `<br>` | `<ul><li>…` | сырой HTML | нативные AsciiDoc-блоки |
| 7 | Многострочная цитата | `<blockquote><p>q1</p><p>q2</p></blockquote>` | `> ` только у первой строки | `> ` у каждой строки |

Причины:

- `parseAnchor` (`App.jsx:29`) берёт **первый** `<a>` регуляркой `([^<]*)` (не допускает вложенной разметки), а `replaceAll` (`App.jsx:79`) подставляет эти url/text во **все** ссылки — в коде стоит `TODO: only works the first time`.
- Для таблиц (`App.jsx:83-87`) `html.match(tableRegex)` возвращает все совпадения, но заменой подставляется результат от `matches[0]` — отсюда потеря данных (в коде `FIX: only first table …`).
- `processHMTLtoASCII` (`App.jsx:75`) заменяет только точные теги без атрибутов и известный список `p/h1/h2/h3/strong/em/s/u/blockquote`; таблица `|` внутри ячейки не экранируется, а `cols` считается по первой строке.
- Прочее: начальный `source = '== Test'` (`App.jsx:14`) не соответствует пустому редактору; конвертация и подсветка выполняются на каждое нажатие без debounce — на больших документах это заметно.

### 7.2 Архитектура и качество кода

- Логика конвертации зашита в презентационный компонент `App.jsx`, не экспортируется и не тестируема.
- `App.jsx` и `main.jsx` — `.jsx` вместо `.tsx`, из-за чего проект нельзя считать полностью мигрированным на TypeScript.
- Импорты через абсолютные пути от корня (`from '/src/widgets/editor/Editor'`) — работают в Vite, но ломают переносимость и навигацию по IDE.
- В `Highlighter` поле `children` объявлено и не используется, `theme` типизирован как `'github' | 'github-dark' | string`, из-за чего союз вырождается в `string`; используется устаревший `React.PureComponent`.
- В `Editor` объявлен неиспользуемый `onSaveBtn`, `defaultValue` применяется только при монтировании, эффект создания Quill зависит от `[ref]`, а `StrictMode` в dev-режиме монтирует/размонтирует редактор дважды (потенциальные утечки tooltip-узлов Quill в `document.body`).
- Мёртвые артефакты шаблона: `src/app/App.css`, `src/assets/*`, `public/icons.svg`.
- Имена проекта: `README` называет его AsciiDoc WYSIWYG, а `package.json` — `my-react-app`, `index.html` — `<title>my-react-app</title>`. При этом каталог и репозиторий — `ascii-wysiwyg`.
- `eslint.config.js` покрывает только JS/JSX, поэтому TS-файлы не линтуются; скрипта `typecheck` в `package.json` нет.
- Нет тестов, CI и описания в README (там лишь заголовок и картинка).

### 7.3 Инфраструктура проверок

`npm run lint` сейчас красный — 11 ошибок в `src/app/App.jsx`: неиспользуемые `React`, `Delta`, `range/setRange`, `lastChange/setLastChange`, `readOnly/setReadOnly`, аргументы `delta`, `oldDelta`, `sourceCode`. Это индикатор недоделанного состояния: `Delta` импортируется, но не нужен, `readOnly` управляется, но в `Editor` не передаётся.

---

## 8. Git

- Текущая ветка `main`, синхронизирована с `origin/main` (`git@github.com:ochaplashkin/ascii-wysiwyg.git`), working tree чистый.
- В репозитории 9 локальных веток, большинство продублированы в `origin` и содержат **параллельную историю** тех же коммитов (`improve-text-processing`, `table-processing`, `transform-heading-to-ascii`, `add-asciidoc-render`, `refactor-after-review`, `project-init`, `add-mui-layout`, `add-fsd-project-structure`). Ветки расходятся от общих точек, поэтому cherry-pick/мерж между ними требует аккуратности.
- `dist/` и `node_modules/` в `.gitignore`; сборка не засоряет дерево.

---

## 9. План улучшений (по приоритету)

1. **Переписать конвертер на обход DOM** вместо `replaceAll`: клонировать HTML в `DOMParser`, рекурсивно обходить узлы и собирать AsciiDoc-строку. Это одним изменением закрывает дефекты №1–7, убирает регулярки по HTML и делает функцию чистой (`html: string → string`).
2. **Вынести в модуль** `src/features/asciidoc-to-html/` (или `lib/asciidoc`) + покрыть Vitest кейсами из таблицы §7.1 и шаблоном `docs/visual-to-ascii.template`.
3. **Инфраструктура:** `npm run typecheck`, зелёный `lint`, перенос `App.jsx`/`main.jsx` в `.tsx`, удаление мёртвых файлов, debounce генерации, актуализация `README`/`index.html`/`package.json` (имя, назначение, запуск).
4. **Функциональность:** двусторонний режим (правка AsciiDoc), сохранение/загрузка файла, экспорт, тема оформления, отображение ошибок разметки.
5. **Качество:** тесты, CI, code-split бандла (сейчас 1.63 МБ одним чанком), `readOnly`/`onSaveBtn` — либо реализовать, либо убрать.

---

## 10. Быстрые подсказки для работы

- Перед изменением конвертера — открой `docs/visual-to-ascii.template`: там зафиксировано целевое соответствие блоков (заголовки, таблица `[cols="1,1"]` + `|===`).
- Проверять результат удобно без ручного ввода: `npm run dev`, затем headless-скриншот
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --screenshot=/tmp/app.png --window-size=1440,900 http://localhost:PORT/`.
- Если правится `Highlighter` — помни, что тема приходит как **строка CSS** (`?raw`), а не как путь.
- Если правится `Editor` — регистрация модуля таблиц (`Quill.register(...)`) должна происходить до создания экземпляра; модуль `table: false` и `"table-better"` работают в паре.
- Скриншот актуального интерфейса: `docs/preview.png`.
