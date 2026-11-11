import { convert } from '@asciidoctor/core';
import { describe, expect, it } from 'vitest';

import type { EditorNode } from '../../editor/types.js';
import { serializeAsciiDoc } from './serialize.js';

const text = (value: string): EditorNode => ({ type: 'text', text: value });
const paragraph = (value: string): EditorNode => ({
  type: 'paragraph',
  content: [text(value)],
});
const cell = (value: string): EditorNode => ({
  type: 'tableCell',
  content: [paragraph(value)],
});
const row = (...cells: EditorNode[]): EditorNode => ({
  type: 'tableRow',
  content: cells,
});

/**
 * AsciiDoc nested tables are syntax-sensitive: the enclosing cell must use the
 * `a|` style, the inner table must use the `!===` delimiter and `!` cell
 * separators. Rendering with Asciidoctor catches accidental corruption that a
 * string assertion alone might miss.
 */
describe('nested table AsciiDoc integration', () => {
  it('renders a table nested in an AsciiDoc cell as two tables', async () => {
    const nested: EditorNode = {
      type: 'table',
      content: [
        row(cell('inner 1'), cell('inner 2')),
        row(cell('inner 3!'), cell('inner 4')),
      ],
    };

    const source = serializeAsciiDoc(
      {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              row(cell('Внешняя')),
              row({
                type: 'tableCell',
                content: [nested, paragraph('После')],
              }),
            ],
          },
        ],
      },
      'Документ',
    );

    expect(source).toContain('a|');
    expect(source).toContain('!===');
    expect(source).toContain('! inner 1');
    expect(source).toContain('! inner 3\\!');

    const html = String(
      await convert(source, {
        header_footer: false,
        safe: 'safe',
      }),
    );

    expect(html.match(/<table/g) ?? []).toHaveLength(2);
    expect(html).toContain('inner 1');
    expect(html).toContain('inner 3!');
    expect(html).toContain('После');
    expect(html).not.toContain('!===');
  });
});
