import { describe, expect, it } from 'vitest';

import type { EditorMark, EditorNode } from '../../editor/types.js';
import { serializeAsciiDoc } from './serialize.js';

const doc = (...content: EditorNode[]): EditorNode => ({ type: 'doc', content });

const paragraph = (...content: EditorNode[]): EditorNode => ({
  type: 'paragraph',
  content,
});

const heading = (level: number, text: string): EditorNode => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

const text = (value: string, marks: EditorMark[] = []): EditorNode => ({
  type: 'text',
  text: value,
  ...(marks.length > 0 ? { marks } : {}),
});

const mark = (type: string, attrs?: Record<string, unknown>): EditorMark => ({
  type,
  ...(attrs ? { attrs } : {}),
});

const listItem = (...content: EditorNode[]): EditorNode => ({
  type: 'listItem',
  content,
});

const bulletList = (...items: EditorNode[]): EditorNode => ({
  type: 'bulletList',
  content: items,
});

const tab = (level: number): EditorNode => heading(level, `H${level}`);

describe('serializeAsciiDoc', () => {
  it('serializes an empty document and empty title as an empty string', () => {
    expect(serializeAsciiDoc(doc(), '')).toBe('');
    expect(serializeAsciiDoc(doc(paragraph()), '   ')).toBe('');
  });

  it('writes the document title and headings 1-5', () => {
    expect(
      serializeAsciiDoc(
        doc(tab(1), tab(2), tab(3), tab(4), tab(5)),
        'Мой документ',
      ),
    ).toBe(
      [
        '= Мой документ',
        '',
        '== H1',
        '',
        '=== H2',
        '',
        '==== H3',
        '',
        '===== H4',
        '',
        '====== H5',
      ].join('\n'),
    );
  });

  it('separates paragraphs and keeps hard breaks', () => {
    expect(
      serializeAsciiDoc(
        doc(
          paragraph(text('Первая строка'), { type: 'hardBreak' }, text('Вторая')),
          paragraph(text('Новый абзац')),
        ),
      ),
    ).toBe('Первая строка +\nВторая\n\nНовый абзац');
  });

  it('serializes inline marks and nested marks', () => {
    expect(
      serializeAsciiDoc(
        doc(
          paragraph(
            text('жирный', [mark('bold')]),
            text(' '),
            text('курсив', [mark('italic')]),
            text(' '),
            text('подчёркнутый', [mark('underline')]),
            text(' '),
            text('удалённый', [mark('strike')]),
            text(' '),
            text('важный', [mark('highlight')]),
            text(' '),
            text('код', [mark('code')]),
            text(' '),
            text('верх', [mark('superscript')]),
            text(' '),
            text('низ', [mark('subscript')]),
            text(' '),
            text('оба', [mark('bold'), mark('italic')]),
          ),
        ),
      ),
    ).toBe(
      '**жирный** __курсив__ [.underline]#подчёркнутый# ' +
        '[.line-through]#удалённый# [.highlight]#важный# `код` ' +
        '^верх^ ~низ~ **__оба__**',
    );
  });

  it('does not emit markup for empty marks', () => {
    expect(serializeAsciiDoc(doc(paragraph(text('', [mark('bold')]))))).toBe('');
  });

  it('serializes links', () => {
    const link = (label: string, href: string): EditorNode =>
      text(label, [mark('link', { href })]);

    expect(
      serializeAsciiDoc(
        doc(
          paragraph(link('Пример', 'https://example.com')),
          paragraph(link('https://example.com', 'https://example.com')),
          paragraph(link('Раздел', '#section')),
          paragraph(link('Документация', 'docs/page.html')),
          paragraph(link('a]b', 'https://example.com')),
          paragraph(link('a\\b', 'https://example.com')),
          paragraph(link('docs/page.html', 'docs/page.html')),
        ),
      ),
    ).toBe(
      [
        'https://example.com[Пример]',
        'https://example.com',
        '<<section,Раздел>>',
        'link:docs/page.html[Документация]',
        'https://example.com[a\\]b]',
        'https://example.com[a\\\\b]',
        'link:docs/page.html[docs/page.html]',
      ].join('\n\n'),
    );
  });

  it('serializes bullet, ordered and nested lists', () => {
    const nested = bulletList(
      listItem(paragraph(text('Вложенный')), bulletList(listItem(paragraph(text('Глубже'))))),
    );

    expect(
      serializeAsciiDoc(
        doc(
          bulletList(
            listItem(paragraph(text('Первый')), nested),
            listItem(paragraph(text('Второй'))),
          ),
          {
            type: 'orderedList',
            attrs: { start: 1 },
            content: [
              listItem(paragraph(text('Раз'))),
              listItem(
                paragraph(text('Два')),
                {
                  type: 'orderedList',
                  content: [listItem(paragraph(text('Три')))],
                },
              ),
            ],
          },
        ),
      ),
    ).toBe(
      [
        '* Первый',
        '** Вложенный',
        '*** Глубже',
        '* Второй',
        '',
        '. Раз',
        '. Два',
        '.. Три',
      ].join('\n'),
    );
  });

  it('adds a blank line when the list type changes on the same level', () => {
    expect(
      serializeAsciiDoc(
        doc(
          bulletList(listItem(paragraph(text('Пункт')))),
          {
            type: 'orderedList',
            content: [listItem(paragraph(text('Шаг')))],
          },
        ),
      ),
    ).toBe('* Пункт\n\n. Шаг');
  });

  it('serializes checked and unchecked task items', () => {
    expect(
      serializeAsciiDoc(
        doc({
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('сделано'))] },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                paragraph(text('не сделано')),
                {
                  type: 'taskList',
                  content: [
                    {
                      type: 'taskItem',
                      attrs: { checked: false },
                      content: [paragraph(text('вложенная'))],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe('* [x] сделано\n* [ ] не сделано\n** [ ] вложенная');
  });

  it('serializes a quote with multiple paragraphs', () => {
    expect(
      serializeAsciiDoc(
        doc({
          type: 'blockquote',
          content: [paragraph(text('Первый абзац')), paragraph(text('Второй абзац'))],
        }),
      ),
    ).toBe('[quote]\n____\nПервый абзац\n\nВторой абзац\n____');
  });

  it('serializes a code block with a language and a safe fence', () => {
    const code = 'if (a) {\n  ----\n}';
    expect(
      serializeAsciiDoc(
        doc({
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: code }],
        }),
      ),
    ).toBe(`[source,js]\n-----\n${code}\n-----`);
  });

  it('serializes a code block without a language', () => {
    expect(
      serializeAsciiDoc(
        doc({ type: 'codeBlock', content: [{ type: 'text', text: 'plain' }] }),
      ),
    ).toBe('[source]\n----\nplain\n----');
  });

  it('serializes a table with a header, empty cells and escaped pipes', () => {
    const cell = (value: string, type = 'tableCell', attrs?: Record<string, unknown>): EditorNode => ({
      type,
      ...(attrs ? { attrs } : {}),
      content: [paragraph(text(value))],
    });

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('Параметр', 'tableHeader'), cell('Значение', 'tableHeader')] },
            { type: 'tableRow', content: [cell('Язык'), cell('AsciiDoc')] },
            { type: 'tableRow', content: [cell('a|b'), { type: 'tableCell', content: [paragraph()] }] },
          ],
        }),
      ),
    ).toBe(
      [
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
      ].join('\n'),
    );
  });

  it('serializes colspan, rowspan and their combination', () => {
    const cell = (attrs: Record<string, unknown>, value: string): EditorNode => ({
      type: 'tableCell',
      attrs,
      content: [paragraph(text(value))],
    });

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell({ colspan: 2 }, 'Широкая')] },
            { type: 'tableRow', content: [cell({ rowspan: 2 }, 'Высокая'), cell({}, 'A')] },
            { type: 'tableRow', content: [cell({ colspan: 2, rowspan: 3 }, 'Обе')] },
          ],
        }),
      ),
    ).toBe(
      [
        '[cols="1,1"]',
        '|===',
        '2+| Широкая',
        '',
        '.2+| Высокая',
        '| A',
        '',
        '2.3+| Обе',
        '|===',
      ].join('\n'),
    );
  });

  it('serializes a multi-paragraph table cell with hard breaks', () => {
    const cell: EditorNode = {
      type: 'tableCell',
      content: [
        paragraph(text('Первая')),
        paragraph(text('Вторая')),
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({ type: 'table', content: [{ type: 'tableRow', content: [cell] }] }),
      ),
    ).toBe('[cols="1"]\n|===\n| Первая +\nВторая\n|===');
  });


  it('serializes a table nested inside an AsciiDoc cell', () => {
    const nestedTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph(text('inner 1'))] },
            { type: 'tableCell', content: [paragraph(text('inner 2'))] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph(text('inner 3'))] },
            { type: 'tableCell', content: [paragraph(text('inner 4'))] },
          ],
        },
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [paragraph(text('Параметр'))] },
                { type: 'tableHeader', content: [paragraph(text('Значение'))] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [paragraph(text('Внешняя'))] },
                {
                  type: 'tableCell',
                  content: [nestedTable, paragraph(text('После'))],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(
      [
        '[cols="1,1",options="header"]',
        '|===',
        '| Параметр',
        '| Значение',
        '',
        '| Внешняя',
        'a|',
        '[cols="1,1"]',
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
      ].join('\n'),
    );
  });

  it('keeps paragraphs before and after a nested table in the same cell', () => {
    const nestedTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', content: [paragraph(text('inner'))] }],
        },
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    paragraph(text('До')),
                    nestedTable,
                    paragraph(text('После')),
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(
      [
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
      ].join('\n'),
    );
  });

  it('combines a cell span with the AsciiDoc cell style for nested tables', () => {
    const nestedTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', content: [paragraph(text('inner'))] }],
        },
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 2 },
                  content: [nestedTable],
                },
              ],
            },
          ],
        }),
      ),
    ).toBe(
      [
        '[cols="1,1"]',
        '|===',
        '2+a|',
        '[cols="1"]',
        '!===',
        '! inner',
        '!===',
        '|===',
      ].join('\n'),
    );
  });

  it('flattens tables nested deeper than one level instead of breaking the outer table', () => {
    const deeperTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph(text('deep 1'))] },
            { type: 'tableCell', content: [paragraph(text('deep 2'))] },
          ],
        },
      ],
    };
    const nestedTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', content: [deeperTable] }],
        },
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [nestedTable] },
              ],
            },
          ],
        }),
      ),
    ).toBe(
      [
        '[cols="1"]',
        '|===',
        'a|',
        '[cols="1"]',
        '!===',
        'a! deep 1 | deep 2',
        '!===',
        '|===',
      ].join('\n'),
    );
  });


  it('escapes the nested table cell separator inside cell text', () => {
    const nestedTable: EditorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', content: [paragraph(text('Привет!'))] }],
        },
      ],
    };

    expect(
      serializeAsciiDoc(
        doc({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', content: [nestedTable] }],
            },
          ],
        }),
      ),
    ).toBe(
      [
        '[cols="1"]',
        '|===',
        'a|',
        '[cols="1"]',
        '!===',
        '! Привет\\!',
        '!===',
        '|===',
      ].join('\n'),
    );
  });

  it('serializes a horizontal rule', () => {
    expect(
      serializeAsciiDoc(doc(paragraph(text('До')), { type: 'horizontalRule' }, paragraph(text('После')))),
    ).toBe("До\n\n'''\n\nПосле");
  });

  it('escapes block markers at the start of a paragraph line', () => {
    const cases: Array<[string, string]> = [
      ['- не список', '\\- не список'],
      ['* не пункт', '\\* не пункт'],
      ['= не заголовок', '\\= не заголовок'],
      ['. не нумерация', '\\. не нумерация'],
      ['| не таблица', '\\| не таблица'],
      [': не атрибут', '\\: не атрибут'],
      ['// не комментарий', '\\// не комментарий'],
      ['[ не якорь', '\\[ не якорь'],
    ];

    for (const [input, output] of cases) {
      expect(serializeAsciiDoc(doc(paragraph(text(input))))).toBe(output);
    }
  });

  it('keeps the content of unknown nodes', () => {
    expect(
      serializeAsciiDoc(
        doc(
          {
            type: 'customBlock',
            content: [paragraph(text('Сохранился'))],
          },
          paragraph(
            text('Привет, ', []),
            {
              type: 'mention',
              content: [{ type: 'text', text: '@user' }],
            },
            text('!'),
          ),
        ),
      ),
    ).toBe('Сохранился\n\nПривет, @user!');
  });
});
