import { MemoryLogger, convert } from '@asciidoctor/core';

import { prefixHtmlIds, sanitizeHtml } from './sanitize.js';

export type BlockKind = 'title' | 'heading' | 'block';

export interface RenderBlock {
  id: string;
  kind: BlockKind;
  /** Sanitized block HTML, ready for `dangerouslySetInnerHTML`. */
  html: string;
  /**
   * Sanitized HTML without per-side id prefixes. Two documents are compared by
   * this value, so ids must not make equal blocks look different.
   */
  key: string;
  /** Plain text, used for similarity checks and debugging. */
  text: string;
}

export interface RenderWarning {
  severity: string;
  text: string;
  line: number | null;
}

export interface RenderResult {
  blocks: RenderBlock[];
  warnings: RenderWarning[];
}

export interface PreviewResult {
  /** Sanitized HTML of the `#content` section. */
  html: string;
  warnings: RenderWarning[];
}

const collectWarnings = (
  logger: ReturnType<typeof MemoryLogger.create>,
): RenderWarning[] =>
  logger
    .getMessages()
    .filter((message) =>
      ['WARN', 'ERROR', 'FATAL'].includes(message.getSeverity()),
    )
    .map((message): RenderWarning => {
      const location = message.getSourceLocation();

      return {
        severity: message.getSeverity(),
        text: message.getText(),
        line: location ? location.getLineNumber() : null,
      };
    });

export interface RenderOptions {
  /** Prefix for element ids; keeps anchors of the two columns unique. */
  idPrefix?: string;
}

const BLOCK_SELECTOR = [
  '.paragraph',
  '.ulist',
  '.olist',
  '.dlist',
  '.hdlist',
  '.qlist',
  '.colist',
  '.tableblock',
  '.listingblock',
  '.literalblock',
  '.exampleblock',
  '.admonitionblock',
  '.quoteblock',
  '.verseblock',
  '.sidebarblock',
  '.openblock',
  '.imageblock',
  '.videoblock',
  '.audioblock',
  '.stemblock',
].join(',');

const CONTAINER_SELECTOR = [
  '#preamble',
  '#content',
  '.sectionbody',
  '.sect1',
  '.sect2',
  '.sect3',
  '.sect4',
  '.sect5',
].join(',');

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';

const normalizeText = (value: string | null) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Renders AsciiDoc to HTML with Asciidoctor and splits the result into
 * top-level content blocks. Blocks are the unit of comparison: a changed
 * paragraph, table or listing is highlighted as a whole.
 *
 * The output is sanitized because Asciidoctor passes raw HTML through even in
 * `safe` mode; the diff view must be able to render arbitrary user documents.
 */
export async function renderAsciiDoc(
  source: string,
  { idPrefix = 'doc' }: RenderOptions = {},
): Promise<RenderResult> {
  const logger = MemoryLogger.create();
  const converted = await convert(source, {
    safe: 'safe',
    standalone: true,
    logger,
  });

  if (typeof converted !== 'string') {
    throw new Error('Asciidoctor did not return HTML');
  }

  const doc = new DOMParser().parseFromString(converted, 'text/html');
  const blocks: RenderBlock[] = [];

  const pushBlock = (element: Element, kind: BlockKind) => {
    const clean = sanitizeHtml(element.outerHTML);

    blocks.push({
      id: `${idPrefix}-block-${blocks.length}`,
      kind,
      html: prefixHtmlIds(clean, idPrefix),
      key: `${kind}\u0000${clean.trim()}`,
      text: normalizeText(element.textContent),
    });
  };

  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();

    if (
      element.id === 'toc' ||
      element.id === 'footer' ||
      element.id === 'header'
    ) {
      return;
    }

    if (HEADING_SELECTOR.includes(tag)) {
      pushBlock(element, 'heading');
      return;
    }

    if (element.matches(BLOCK_SELECTOR) || tag === 'hr') {
      pushBlock(element, 'block');
      return;
    }

    if (element.matches(CONTAINER_SELECTOR)) {
      Array.from(element.children).forEach(walk);
      return;
    }

    // Unknown wrapper: descend if it contains known content blocks, otherwise
    // treat it as a single block instead of splitting its inline markup.
    if (
      element.querySelector(BLOCK_SELECTOR) ||
      element.querySelector(HEADING_SELECTOR)
    ) {
      Array.from(element.children).forEach(walk);
      return;
    }

    if (
      normalizeText(element.textContent) ||
      element.querySelector('img, pre, hr')
    ) {
      pushBlock(element, 'block');
    }
  };

  const header = doc.getElementById('header');
  const title = header?.querySelector('h1');
  if (title) {
    pushBlock(title, 'title');
  }

  const content = doc.getElementById('content');
  if (content) {
    Array.from(content.children).forEach(walk);
  }

  const warnings = collectWarnings(logger);

  return { blocks, warnings };
}

/**
 * Full-document preview used by the source editor. Returns the sanitized
 * `#content` HTML instead of splitting it into diff blocks.
 *
 * When the source is malformed Asciidoctor still produces HTML; the warnings
 * are surfaced next to the preview instead of replacing it.
 */
export async function renderAsciiDocPreview(
  source: string,
): Promise<PreviewResult> {
  const logger = MemoryLogger.create();
  const converted = await convert(source, {
    safe: 'safe',
    standalone: true,
    logger,
  });

  if (typeof converted !== 'string') {
    throw new Error('Asciidoctor did not return HTML');
  }

  const doc = new DOMParser().parseFromString(converted, 'text/html');
  const header = doc.getElementById('header');
  const content = doc.getElementById('content');

  // The document title lives in `#header`, not in `#content`; the preview must
  // show it, otherwise a `= Title` line silently disappears from the page.
  const raw = `${header ? header.innerHTML : ''}${
    content ? content.innerHTML : doc.body.innerHTML
  }`;

  return {
    html: sanitizeHtml(raw),
    warnings: collectWarnings(logger),
  };
}
