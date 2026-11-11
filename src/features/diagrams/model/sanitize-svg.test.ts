// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeSvg } from './sanitize-svg.js';

describe('sanitizeSvg', () => {
  it('keeps the drawing and its styles', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:red}</style>' +
        '<rect class="a" width="10" height="10" style="stroke:#000"/></svg>',
    );

    expect(clean).toContain('<svg');
    expect(clean).toContain('<style>');
    expect(clean).toContain('<rect');
    expect(clean).toContain('style="stroke:#000"');
  });

  it('removes scripts, foreign objects and external references', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<script>alert(1)</script>' +
        '<foreignObject><div>html</div></foreignObject>' +
        '<rect width="10" height="10" onload="alert(2)"/>' +
        '<a xlink:href="https://evil.example/"><text>link</text></a>' +
        '</svg>',
    );

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('foreignObject');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('evil.example');
  });
});
