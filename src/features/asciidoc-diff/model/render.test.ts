// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { renderAsciiDoc } from './render.js';

describe('renderAsciiDoc', () => {
  it('extracts a title, headings and content blocks', async () => {
    const source = [
      '= Title',
      '',
      '== Section',
      '',
      'Hello *world*.',
      '',
      '[source,js]',
      '----',
      'const x = 1;',
      '----',
    ].join('\n');

    const { blocks, warnings } = await renderAsciiDoc(source, {
      idPrefix: 'left',
    });

    expect(warnings).toEqual([]);
    expect(blocks.map((block) => block.kind)).toEqual([
      'title',
      'heading',
      'block',
      'block',
    ]);
    expect(blocks[1]?.html).toContain('id="left_section"');
    expect(blocks.some((block) => block.html.includes('const x = 1;'))).toBe(
      true,
    );
  });

  it('produces the same matching keys for both sides', async () => {
    const source = '== Intro\n\nSame text.';

    const left = await renderAsciiDoc(source, { idPrefix: 'left' });
    const right = await renderAsciiDoc(source, { idPrefix: 'right' });

    expect(left.blocks.map((block) => block.key)).toEqual(
      right.blocks.map((block) => block.key),
    );
  });

  it('sanitizes passthrough HTML from AsciiDoc', async () => {
    const { blocks } = await renderAsciiDoc(
      'pass:[<img src=x onerror="alert(1)">]',
      { idPrefix: 'x' },
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.html).not.toContain('onerror');
  });

  it('returns warnings from Asciidoctor', async () => {
    const { warnings } = await renderAsciiDoc(
      'include::definitely-missing-file.adoc[]',
      { idPrefix: 'x' },
    );

    expect(warnings.some((warning) => /include/i.test(warning.text))).toBe(true);
  });

  it('returns no blocks for an empty document', async () => {
    const { blocks } = await renderAsciiDoc('');

    expect(blocks).toEqual([]);
  });
});
