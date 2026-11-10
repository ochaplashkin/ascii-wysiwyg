import { describe, expect, it } from 'vitest';

import { inlineDiff } from './inline-diff.js';

describe('inlineDiff', () => {
  it('returns null for identical blocks', () => {
    expect(inlineDiff('<p>same</p>', '<p>same</p>')).toBeNull();
  });

  it('wraps only inserted and removed text', () => {
    const result = inlineDiff('<p>hello world</p>', '<p>hello brave world</p>');

    expect(result).not.toBeNull();
    expect(result?.leftHtml).toBe('<p>hello world</p>');
    expect(result?.rightHtml).toContain('>brave</ins>');
    expect(result?.rightHtml).not.toContain('<del');
  });

  it('replaces words and keeps inline markup intact', () => {
    const result = inlineDiff(
      '<p><strong>alpha</strong> beta</p>',
      '<p><strong>alpha</strong> gamma</p>',
    );

    expect(result?.rightHtml).toContain('<strong>alpha</strong>');
    expect(result?.rightHtml).toContain('>gamma</ins>');
    expect(result?.rightHtml).not.toContain('<ins class="adoc-word adoc-word--ins"><strong>');
    expect(result?.leftHtml).toContain('>beta</del>');
  });

  it('keeps entities atomic', () => {
    const result = inlineDiff(
      '<p>A &amp; B</p>',
      '<p>A &amp; C</p>',
    );

    expect(result?.leftHtml).toContain('A &amp; ');
    expect(result?.rightHtml).toContain('A &amp; ');
    expect(result?.rightHtml).toContain('>C</ins>');
    expect(result?.rightHtml).not.toContain('&amp<ins');
  });

  it('highlights table cell changes and keeps the table structure', () => {
    const result = inlineDiff(
      '<table class="tableblock"><tbody><tr><td>ru-RU</td></tr></tbody></table>',
      '<table class="tableblock"><tbody><tr><td>en-US</td></tr></tbody></table>',
    );

    expect(result?.rightHtml).toContain('<td>');
    expect(result?.rightHtml).toContain('</table>');
    expect(result?.rightHtml).toContain('<ins');
    expect(result?.leftHtml).toContain('<del');
  });

  it('returns null when only markup changed', () => {
    expect(
      inlineDiff('<p class="a">same</p>', '<p class="b">same</p>'),
    ).toBeNull();
  });
});
