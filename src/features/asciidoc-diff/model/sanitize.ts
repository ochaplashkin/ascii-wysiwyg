import DOMPurify, { type DOMPurify as Purifier } from 'dompurify';

/**
 * Asciidoctor intentionally passes raw HTML through in every safe mode. Since
 * the diff view renders user-provided AsciiDoc, the converted HTML must be
 * sanitized before it reaches `dangerouslySetInnerHTML`.
 */
const FORBIDDEN_TAGS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
  'base',
  'noscript',
];

const FORBIDDEN_ATTRS = [
  'style',
  'srcdoc',
  'formaction',
  'xlink:href',
  'srcset',
];

const DANGEROUS_PROTOCOL = /^\s*(?:javascript|vbscript|data)\s*:/i;
const EXTERNAL_LINK = /^\s*https?:/i;

let purifier: Purifier | null = null;

const getPurifier = (): Purifier => {
  if (!purifier) {
    // `DOMPurify` is callable and binds itself to the given window. In tests
    // (jsdom) and in the browser `window` is always present by this point.
    purifier = DOMPurify(window);
  }
  return purifier;
};

const prefixIds = (root: DocumentFragment, idPrefix: string) => {
  if (!idPrefix) return;

  root.querySelectorAll('[id]').forEach((element) => {
    const id = element.getAttribute('id');
    if (id) element.setAttribute('id', `${idPrefix}${id}`);
  });

  root.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href) anchor.setAttribute('href', `#${idPrefix}${href.slice(1)}`);
  });
};

/**
 * Adds a prefix to ids in an already sanitized HTML string. The diff view
 * renders the same document on both sides, so ids must stay unique.
 */
export function prefixHtmlIds(html: string, idPrefix: string): string {
  if (!idPrefix) return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  prefixIds(template.content, idPrefix);
  return template.innerHTML;
}

const hardenLinks = (root: DocumentFragment) => {
  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    if (!href || DANGEROUS_PROTOCOL.test(href)) {
      anchor.removeAttribute('href');
      return;
    }

    if (EXTERNAL_LINK.test(href)) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });

  root.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    if (!src || DANGEROUS_PROTOCOL.test(src)) {
      image.remove();
      return;
    }
    image.setAttribute('loading', 'lazy');
  });
};

export interface SanitizeOptions {
  /** Prepended to every `id` so two documents never share anchors. */
  idPrefix?: string;
}

/**
 * Cleans a rendered AsciiDoc block and makes its links safe to embed.
 */
export function sanitizeHtml(
  html: string,
  { idPrefix = '' }: SanitizeOptions = {},
): string {
  const clean = getPurifier().sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTRS,
    ADD_ATTR: ['target'],
    ALLOW_DATA_ATTR: false,
  });

  const template = document.createElement('template');
  template.innerHTML = clean;
  const root = template.content;

  prefixIds(root, idPrefix);
  hardenLinks(root);

  return template.innerHTML;
}
