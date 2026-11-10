// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('removes scripts, handlers and dangerous URLs', () => {
    const html = sanitizeHtml(
      '<p onclick="alert(1)">hi<script>alert(2)</script>' +
        '<a href="javascript:alert(3)">x</a>' +
        '<img src="x" onerror="alert(4)"></p>',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('removes iframes and forms but keeps content markup', () => {
    const html = sanitizeHtml(
      '<iframe src="https://example.com"></iframe>' +
        '<form><input value="x"></form>' +
        '<table><tbody><tr><td><strong>x</strong></td></tr></tbody></table>' +
        '<pre><code>const a = 1;</code></pre>',
    );

    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).toContain('<table>');
    expect(html).toContain('<strong>x</strong>');
    expect(html).toContain('<pre><code>');
  });

  it('hardens external links', () => {
    const html = sanitizeHtml('<p><a href="https://example.com">site</a></p>');

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('prefixes ids and internal links', () => {
    const html = sanitizeHtml(
      '<h2 id="_intro">Intro</h2><p><a href="#_intro">go</a></p>',
      { idPrefix: 'left-' },
    );

    expect(html).toContain('id="left-_intro"');
    expect(html).toContain('href="#left-_intro"');
  });

  it('strips inline styles', () => {
    const html = sanitizeHtml('<p style="position:fixed">x</p>');

    expect(html).not.toContain('style=');
  });
});
