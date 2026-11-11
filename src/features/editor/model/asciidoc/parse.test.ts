import { describe, expect, it } from 'vitest';

import type { EditorNode } from '../../editor/types.js';
import { parseAsciiDoc } from './parse.js';
import { serializeAsciiDoc } from './serialize.js';

function roundTrip(source: string): string {
  const result = parseAsciiDoc(source);
  return serializeAsciiDoc(result.doc, result.title);
}

function firstBlock(source: string): EditorNode | undefined {
  return parseAsciiDoc(source).doc.content?.[0];
}

function paragraphNodes(source: string): EditorNode[] {
  return firstBlock(source)?.content ?? [];
}

function join(...lines: string[]): string {
  return lines.join('\n');
}

function textOf(node: EditorNode | undefined): string {
  if (!node) {
    return '';
  }
  if (typeof node.text === 'string') {
    return node.text;
  }
  return (node.content ?? []).map((child) => textOf(child)).join('');
}

describe('parseAsciiDoc', () => {
  it('parses empty input', () => {
    expect(parseAsciiDoc('')).toEqual({
      title: '',
      doc: { type: 'doc', content: [] },
      warnings: [],
    });
  });

  it('takes the document title out of the body', () => {
    const result = parseAsciiDoc(join('= Мой документ', '', '== Раздел', '', 'Текст'));

    expect(result.title).toBe('Мой документ');
    expect(result.doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Раздел' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] },
      ],
    });
    expect(result.warnings).toEqual([]);
  });

  it('does not treat == as the document title', () => {
    const result = parseAsciiDoc('== Раздел');
    expect(result.title).toBe('');
    expect(result.doc.content?.[0]?.type).toBe('heading');
  });

  it('parses headings levels 1-5', () => {
    const source = join(
      '== H1',
      '',
      '=== H2',
      '',
      '==== H3',
      '',
      '===== H4',
      '',
      '====== H5',
    );
    const result = parseAsciiDoc(source);
    const levels = (result.doc.content ?? []).map(
      (node) => node.attrs?.level,
    );

    expect(levels).toEqual([1, 2, 3, 4, 5]);
    expect(serializeAsciiDoc(result.doc, result.title)).toBe(source);
  });

  it('keeps hard breaks', () => {
    const source = 'Первая строка +\nВторая';
    const content = paragraphNodes(source);

    expect(content.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    expect(content.map((node) => node.text)).toEqual([
      'Первая строка',
      undefined,
      'Вторая',
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses every inline mark', () => {
    const cases: Array<{
      source: string;
      text: string;
      mark: string;
      canonical: string;
      offset?: number;
    }> = [
      { source: '**жирный**', text: 'жирный', mark: 'bold', canonical: '**жирный**' },
      { source: '__курсив__', text: 'курсив', mark: 'italic', canonical: '__курсив__' },
      { source: '_курсив_', text: 'курсив', mark: 'italic', canonical: '__курсив__' },
      { source: '`код`', text: 'код', mark: 'code', canonical: '`код`' },
      {
        source: '+сырой `код`+',
        text: 'сырой `код`',
        mark: 'code',
        canonical: '+сырой `код`+',
      },
      {
        source: 'текст [.underline]#подчёркнутый#',
        text: 'подчёркнутый',
        mark: 'underline',
        canonical: 'текст [.underline]#подчёркнутый#',
        offset: 1,
      },
      {
        source: 'текст [.line-through]#зачёркнутый#',
        text: 'зачёркнутый',
        mark: 'strike',
        canonical: 'текст [.line-through]#зачёркнутый#',
        offset: 1,
      },
      {
        source: 'текст [.highlight]#выделенный#',
        text: 'выделенный',
        mark: 'highlight',
        canonical: 'текст [.highlight]#выделенный#',
        offset: 1,
      },
      { source: '^верхний^', text: 'верхний', mark: 'superscript', canonical: '^верхний^' },
      { source: '~нижний~', text: 'нижний', mark: 'subscript', canonical: '~нижний~' },
    ];

    for (const item of cases) {
      const result = parseAsciiDoc(item.source);
      const node = result.doc.content?.[0]?.content?.[item.offset ?? 0];

      expect(node?.text, item.source).toBe(item.text);
      expect(node?.marks, item.source).toEqual([{ type: item.mark }]);
      expect(serializeAsciiDoc(result.doc, result.title), item.source).toBe(
        item.canonical,
      );
    }
  });

  it('puts bold and italic on one text node for nested marks', () => {
    const result = parseAsciiDoc('**__оба__**');
    const node = result.doc.content?.[0]?.content?.[0];

    expect(node?.type).toBe('text');
    expect(node?.text).toBe('оба');
    expect(node?.marks).toEqual([{ type: 'bold' }, { type: 'italic' }]);
    expect(serializeAsciiDoc(result.doc, result.title)).toBe('**__оба__**');
  });

  it('parses adjacent marks and plain text', () => {
    const source = '**жирный** и __курсив__ конец';
    const result = parseAsciiDoc(source);

    expect(serializeAsciiDoc(result.doc, result.title)).toBe(source);
  });

  it('unescapes escaped inline characters', () => {
    const source = '\\*literal\\* и \\| и \\] и \\\\ конец';
    const content = paragraphNodes(source);

    expect(content).toHaveLength(1);
    expect(content[0]?.text).toBe('*literal* и | и ] и \\ конец');
    expect(content[0]?.marks).toBeUndefined();
  });

  it('parses links', () => {
    const cases: Array<{
      source: string;
      text: string;
      href: string;
      canonical: string;
    }> = [
      {
        source: 'https://example.com[Пример]',
        text: 'Пример',
        href: 'https://example.com',
        canonical: 'https://example.com[Пример]',
      },
      {
        source: 'https://example.com',
        text: 'https://example.com',
        href: 'https://example.com',
        canonical: 'https://example.com',
      },
      {
        source: 'link:docs/page.html[Документация]',
        text: 'Документация',
        href: 'docs/page.html',
        canonical: 'link:docs/page.html[Документация]',
      },
      {
        source: '<<anchor,Раздел>>',
        text: 'Раздел',
        href: '#anchor',
        canonical: '<<anchor,Раздел>>',
      },
      {
        source: '<<anchor>>',
        text: 'anchor',
        href: '#anchor',
        canonical: '<<anchor>>',
      },
      {
        source: 'https://example.com[a\\]b]',
        text: 'a]b',
        href: 'https://example.com',
        canonical: 'https://example.com[a\\]b]',
      },
    ];

    for (const item of cases) {
      const result = parseAsciiDoc(item.source);
      const node = result.doc.content?.[0]?.content?.[0];

      expect(node?.text, item.source).toBe(item.text);
      expect(node?.marks, item.source).toEqual([
        { type: 'link', attrs: { href: item.href } },
      ]);
      expect(serializeAsciiDoc(result.doc, result.title), item.source).toBe(
        item.canonical,
      );
    }
  });

  it('parses nested bullet lists', () => {
    const source = join('* Первый', '** Вложенный', '*** Глубже', '* Второй');
    const block = firstBlock(source);

    expect(block?.type).toBe('bulletList');
    expect(block?.content).toHaveLength(2);
    expect(block?.content?.[0]?.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'bulletList',
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses nested ordered lists', () => {
    const source = join('. Раз', '. Два', '.. Три');
    const block = firstBlock(source);

    expect(block?.type).toBe('orderedList');
    expect(block?.content?.[1]?.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'orderedList',
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses task lists with nesting', () => {
    const source = join(
      '* [x] Сделано',
      '* [ ] Не сделано',
      '** [ ] Вложенная',
    );
    const block = firstBlock(source);

    expect(block?.type).toBe('taskList');
    expect(block?.content?.[0]?.attrs).toEqual({ checked: true });
    expect(block?.content?.[1]?.attrs).toEqual({ checked: false });
    expect(block?.content?.[1]?.content?.[1]?.type).toBe('taskList');
    expect(roundTrip(source)).toBe(source);
  });

  it('appends a continuation paragraph to the preceding list item', () => {
    const source = join(
      '* Пункт',
      '+',
      'Дополнительный абзац',
      '* Второй',
    );
    const item = firstBlock(source)?.content?.[0];

    expect(item?.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(item?.content?.[1]?.content?.[0]?.text).toBe(
      'Дополнительный абзац',
    );
    expect(roundTrip(source)).toBe(source);
  });

  it('keeps hard breaks inside a list item', () => {
    const source = join(
      '* Первая строка +',
      'Вторая строка',
      '* Следующий пункт',
    );
    const list = firstBlock(source);
    const paragraph = list?.content?.[0]?.content?.[0];

    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    expect(list?.content).toHaveLength(2);
    expect(roundTrip(source)).toBe(source);
  });

  it('separates bullet and ordered lists with a blank line', () => {
    const source = join('* Пункт', '', '. Шаг');
    expect(roundTrip(source)).toBe(source);
  });

  it('parses a quote with multiple paragraphs', () => {
    const source = join(
      '[quote]',
      '____',
      'Первый абзац',
      '',
      'Второй абзац',
      '____',
    );
    const block = firstBlock(source);

    expect(block?.type).toBe('blockquote');
    expect(block?.content).toHaveLength(2);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses a code block with a language', () => {
    const source = join('[source,js]', '----', 'const a = 1;', '----');
    const block = firstBlock(source);

    expect(block).toEqual({
      type: 'codeBlock',
      attrs: { language: 'js' },
      content: [{ type: 'text', text: 'const a = 1;' }],
    });
    expect(roundTrip(source)).toBe(source);
  });

  it('parses a code block without a language and dot fences', () => {
    const source = join('[source]', '....', 'plain', '....');
    const block = firstBlock(source);

    expect(block).toEqual({
      type: 'codeBlock',
      attrs: { language: '' },
      content: [{ type: 'text', text: 'plain' }],
    });
    expect(serializeAsciiDoc(parseAsciiDoc(source).doc)).toBe(
      join('[source]', '----', 'plain', '----'),
    );
  });

  it('parses a table with a header, escaped pipes and an empty cell', () => {
    const source = join(
      '[cols="1,1",options="header"]',
      '|===',
      '| Параметр',
      '| Значение',
      '',
      '| Язык',
      '| AsciiDoc',
      '',
      '| a\\|b',
      '|',
      '|===',
    );
    const table = firstBlock(source);

    expect(table?.type).toBe('table');
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(table?.content?.[0]?.content?.[1]?.type).toBe('tableHeader');
    expect(table?.content?.[1]?.content?.[0]?.type).toBe('tableCell');
    expect(table?.content?.[2]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe(
      'a|b',
    );
    expect(table?.content?.[2]?.content?.[1]?.content?.[0]?.type).toBe(
      'paragraph',
    );
    expect(roundTrip(source)).toBe(source);
  });

  it('parses table spans', () => {
    const source = join(
      '[cols="1,1"]',
      '|===',
      '2+| Широкая',
      '',
      '.2+| Высокая',
      '| A',
      '',
      '2.3+| Обе',
      '|===',
    );
    const table = firstBlock(source);

    expect(table?.content?.[0]?.content?.[0]?.attrs).toEqual({ colspan: 2 });
    expect(table?.content?.[1]?.content?.[0]?.attrs).toEqual({ rowspan: 2 });
    expect(table?.content?.[2]?.content?.[0]?.attrs).toEqual({
      colspan: 2,
      rowspan: 3,
    });
    expect(roundTrip(source)).toBe(source);
  });

  it('chunks cells from one row group into rows by the column count', () => {
    const source = join('|===', '| A | B', '| 1 | 2', '|===');
    const table = firstBlock(source);

    expect(table?.content).toHaveLength(2);
    expect(table?.content?.[0]?.content?.map((cell) => textOf(cell))).toEqual([
      'A',
      'B',
    ]);
    expect(table?.content?.[1]?.content?.map((cell) => textOf(cell))).toEqual([
      '1',
      '2',
    ]);

    const canonical = join(
      '[cols="1,1"]',
      '|===',
      '| A',
      '| B',
      '',
      '| 1',
      '| 2',
      '|===',
    );
    expect(roundTrip(source)).toBe(canonical);
    expect(parseAsciiDoc(canonical).doc).toEqual(parseAsciiDoc(source).doc);
  });

  it('chunks row groups using an explicit cols attribute', () => {
    const source = join(
      '[cols="1,1"]',
      '|===',
      '| A | B',
      '| 1 | 2',
      '|===',
    );
    const table = firstBlock(source);

    expect(table?.content).toHaveLength(2);
    expect(table?.content?.[0]?.content?.map((cell) => textOf(cell))).toEqual([
      'A',
      'B',
    ]);
    expect(table?.content?.[1]?.content?.map((cell) => textOf(cell))).toEqual([
      '1',
      '2',
    ]);
  });

  it('joins multi-line cells with hard breaks', () => {
    const source = join(
      '[cols="1"]',
      '|===',
      '| Первая +',
      'Вторая',
      '|===',
    );
    const paragraph = firstBlock(source)?.content?.[0]?.content?.[0]?.content?.[0];

    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses a nested table inside an AsciiDoc cell', () => {
    const source = join(
      '[cols="1"]',
      '|===',
      '| Внешняя',
      '',
      'a|',
      '[cols="1,1",options="header"]',
      '!===',
      '! inner 1',
      '! inner 2',
      '',
      '! inner 3',
      '! inner 4',
      '!===',
      '',
      'После',
      '|===',
    );
    const outer = firstBlock(source);
    const asciiDocCell = outer?.content?.[1]?.content?.[0];

    expect(asciiDocCell?.content?.map((node) => node.type)).toEqual([
      'table',
      'paragraph',
    ]);
    expect(asciiDocCell?.content?.[0]?.content?.[0]?.content?.[0]?.type).toBe(
      'tableHeader',
    );
    expect(roundTrip(source)).toBe(source);
  });

  it('unescapes the nested table cell separator', () => {
    const source = join(
      '[cols="1"]',
      '|===',
      'a|',
      '[cols="1"]',
      '!===',
      '! Привет\\!',
      '!===',
      '|===',
    );
    const textNode = firstBlock(source);

    expect(textOf(textNode)).toBe('Привет!');
    expect(roundTrip(source)).toBe(source);
  });

  it('keeps paragraphs before and after a nested table in the same cell', () => {
    const source = join(
      '[cols="1"]',
      '|===',
      'a| До',
      '',
      '[cols="1"]',
      '!===',
      '! inner',
      '!===',
      '',
      'После',
      '|===',
    );
    const cell = firstBlock(source)?.content?.[0]?.content?.[0];

    expect(cell?.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'table',
      'paragraph',
    ]);
    expect(roundTrip(source)).toBe(source);
  });

  it('parses a nested table without an explicit cols attribute', () => {
    const source = join(
      '[cols="1"]',
      '|===',
      'a|',
      '!===',
      '! inner',
      '!===',
      '|===',
    );
    const cell = firstBlock(source)?.content?.[0]?.content?.[0];

    expect(cell?.content?.[0]?.type).toBe('table');
    expect(textOf(cell)).toBe('inner');
    expect(serializeAsciiDoc(parseAsciiDoc(source).doc)).toBe(
      join(
        '[cols="1"]',
        '|===',
        'a|',
        '[cols="1"]',
        '!===',
        '! inner',
        '!===',
        '|===',
      ),
    );
  });

  it('combines a cell span with the AsciiDoc cell style', () => {
    const source = join(
      '[cols="1,1"]',
      '|===',
      '2+a|',
      '[cols="1"]',
      '!===',
      '! inner',
      '!===',
      '|===',
    );
    const cell = firstBlock(source)?.content?.[0]?.content?.[0];

    expect(cell?.attrs).toEqual({ colspan: 2 });
    expect(cell?.content?.[0]?.type).toBe('table');
    expect(roundTrip(source)).toBe(source);
  });

  it('accepts table attributes with spaces after commas', () => {
    const source = join(
      '[cols="1, 1", options="header"]',
      '|===',
      '| A',
      '| B',
      '',
      '| 1',
      '| 2',
      '|===',
    );
    const table = firstBlock(source);

    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(serializeAsciiDoc(parseAsciiDoc(source).doc)).toBe(
      join(
        '[cols="1,1",options="header"]',
        '|===',
        '| A',
        '| B',
        '',
        '| 1',
        '| 2',
        '|===',
      ),
    );
  });

  it('trims only trailing newlines from a raw block', () => {
    const source = serializeAsciiDoc({
      type: 'doc',
      content: [
        { type: 'rawAsciiDoc', attrs: { text: '// комментарий\n\n' } },
      ],
    });

    expect(source).toBe('// комментарий');
  });

  it('parses a horizontal rule', () => {
    const source = join('До', '', "'''", '', 'После');
    const result = parseAsciiDoc(source);

    expect(result.doc.content?.[1]?.type).toBe('horizontalRule');
    expect(serializeAsciiDoc(result.doc, result.title)).toBe(source);
  });

  it('preserves unsupported constructs as raw blocks', () => {
    const cases: Array<{ source: string; text: string; preview: string }> = [
      { source: '// комментарий', text: '// комментарий', preview: '// комментарий' },
      { source: ':description: Демо', text: ':description: Демо', preview: ':description: Демо' },
      {
        source: 'include::partial.adoc[]',
        text: 'include::partial.adoc[]',
        preview: 'include::partial.adoc[]',
      },
      { source: 'NOTE: Важно', text: 'NOTE: Важно', preview: 'NOTE: Важно' },
      {
        source: 'image::photo.png[Фото]',
        text: 'image::photo.png[Фото]',
        preview: 'image::photo.png[Фото]',
      },
    ];

    for (const item of cases) {
      const result = parseAsciiDoc(item.source);
      const node = result.doc.content?.[0];

      expect(result.doc.content, item.source).toHaveLength(1);
      expect(node?.type, item.source).toBe('rawAsciiDoc');
      expect(node?.attrs?.text, item.source).toBe(item.text);
      expect(result.warnings, item.source).toEqual([
        { kind: 'raw', preview: item.preview, line: 1 },
      ]);
      expect(serializeAsciiDoc(result.doc, result.title), item.source).toBe(
        item.text,
      );
    }
  });

  it('groups contiguous unknown lines into one raw block', () => {
    const source = join('// один', ':attr: x');
    const result = parseAsciiDoc(source);

    expect(result.doc.content).toHaveLength(1);
    expect(result.doc.content?.[0]?.attrs?.text).toBe(source);
    expect(result.warnings).toEqual([
      { kind: 'raw', preview: '// один', line: 1 },
    ]);
  });

  it('keeps raw blocks between supported blocks', () => {
    const source = join(
      '= Документ',
      '',
      '// комментарий',
      '',
      'Абзац',
      '',
      'image::photo.png[Фото]',
    );
    const result = parseAsciiDoc(source);

    expect((result.doc.content ?? []).map((node) => node.type)).toEqual([
      'rawAsciiDoc',
      'paragraph',
      'rawAsciiDoc',
    ]);
    expect(result.warnings).toEqual([
      { kind: 'raw', preview: '// комментарий', line: 3 },
      { kind: 'raw', preview: 'image::photo.png[Фото]', line: 7 },
    ]);
  });

  it('turns an unclosed delimited block into raw content without throwing', () => {
    const source = join('[example]', '====', 'Содержимое', '', 'Ещё');

    expect(() => parseAsciiDoc(source)).not.toThrow();

    const result = parseAsciiDoc(source);
    expect(result.doc.content).toHaveLength(1);
    expect(result.doc.content?.[0]?.type).toBe('rawAsciiDoc');
    expect(result.doc.content?.[0]?.attrs?.text).toBe(source);
    expect(result.warnings).toHaveLength(1);
  });

  it('preserves a closed unknown delimited block as one raw block', () => {
    const source = join('[example]', '====', 'Содержимое', '', 'Ещё', '====');
    const result = parseAsciiDoc(source);

    expect(result.doc.content).toHaveLength(1);
    expect(result.doc.content?.[0]?.type).toBe('rawAsciiDoc');
    expect(result.doc.content?.[0]?.attrs?.text).toBe(source);
    expect(result.warnings).toEqual([
      { kind: 'raw', preview: '[example]', line: 1 },
    ]);
  });

  it('turns an unclosed source block into raw content', () => {
    const source = join('[source,js]', '----', 'const a = 1;');
    const result = parseAsciiDoc(source);

    expect(result.doc.content?.[0]?.type).toBe('rawAsciiDoc');
    expect(result.doc.content?.[0]?.attrs?.text).toBe(source);
    expect(result.warnings).toHaveLength(1);
  });

  it('does not throw on malformed input', () => {
    expect(() => parseAsciiDoc('|===\n| a | b\n[cols="1"]')).not.toThrow();
  });

  it('round-trips every supported construct byte for byte', () => {
    const source = join(
      '= Мой документ',
      '',
      '== Заголовок 1',
      '',
      '=== Заголовок 2',
      '',
      '==== Заголовок 3',
      '',
      '===== Заголовок 4',
      '',
      '====== Заголовок 5',
      '',
      'Абзац с **жирным**, __курсивом__, `кодом`, +код с `+, [.underline]#подчёркнутым#, [.line-through]#зачёркнутым#, [.highlight]#выделенным#, ^верхним^ и ~нижним~, **__оба__**.',
      '',
      'Строка один +',
      'Строка два',
      '',
      'https://example.com[Пример]',
      '',
      'https://example.com',
      '',
      'link:docs/page.html[Документация]',
      '',
      '<<section,Раздел>>',
      '',
      '<<anchor>>',
      '',
      '\\* не список',
      '',
      '* Пункт',
      '** Вложенный',
      '*** Глубже',
      '+',
      'Дополнительный абзац',
      '* Второй',
      '',
      '. Раз',
      '. Два',
      '.. Три',
      '',
      '* [x] Сделано',
      '* [ ] Не сделано',
      '** [ ] Вложенная',
      '',
      '[quote]',
      '____',
      'Первый абзац',
      '',
      'Второй абзац',
      '____',
      '',
      '[source,js]',
      '----',
      'const a = 1;',
      '----',
      '',
      '[source]',
      '----',
      'plain',
      '----',
      '',
      '[cols="1,1",options="header"]',
      '|===',
      '| Параметр',
      '| Значение',
      '',
      '| Язык',
      '| AsciiDoc',
      '',
      '| a\\|b',
      '|',
      '|===',
      '',
      '[cols="1,1"]',
      '|===',
      '2+| Широкая',
      '',
      '.2+| Высокая',
      '| A',
      '',
      '2.3+| Обе',
      '|===',
      '',
      '[cols="1"]',
      '|===',
      '| Первая +',
      'Вторая',
      '|===',
      '',
      '[cols="1"]',
      '|===',
      '| Внешняя',
      '',
      'a|',
      '[cols="1,1",options="header"]',
      '!===',
      '! inner 1',
      '! inner 2',
      '',
      '! inner 3',
      '! inner 4',
      '!===',
      '',
      'После',
      '|===',
      '',
      "'''",
    );

    const first = parseAsciiDoc(source);
    expect(first.warnings).toEqual([]);
    const canonical = serializeAsciiDoc(first.doc, first.title);
    expect(canonical).toBe(source);

    const second = parseAsciiDoc(canonical);
    expect(second.title).toBe(first.title);
    expect(second.doc).toEqual(first.doc);
    expect(second.warnings).toEqual(first.warnings);
  });
});
