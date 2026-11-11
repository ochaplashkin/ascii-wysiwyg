import { MemoryLogger, convert } from '@asciidoctor/core';

import { beginDiagramRender } from '../../diagrams/model/asciidoctor-extension.js';
import {
  diagramKeyExtra,
  diagramKeyHtml,
  diagramWarnings,
  hydrateDiagramHtml,
  renderDiagramRequests,
} from '../../diagrams/model/hydrate.js';
import type {
  DiagramRenderContext,
  PlantUmlOutcome,
  PlantUmlRequest,
} from '../../diagrams/model/types.js';
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
  /** Directory of the source document, used to resolve `plantuml::` targets. */
  baseDir?: string;
  /** Reads a referenced file (a `.puml` diagram) from the picked folder. */
  readAsset?: (path: string) => Promise<string>;
  /** Kroki base URL; `null`/absent renders diagrams as an error fallback. */
  krokiUrl?: string | null;
}

const diagramContext = (options: RenderOptions): DiagramRenderContext => ({
  baseDir: options.baseDir ?? '',
  readAsset: options.readAsset ?? null,
  krokiUrl: options.krokiUrl ?? null,
});

/**
 * Runs one Asciidoctor conversion with the PlantUML macro extension and
 * renders every collected request through Kroki.
 *
 * The extension only records requests and emits pass-block placeholders, so
 * conversion stays synchronous/consistent while I/O happens afterwards.
 */
const convertWithDiagrams = async (
  source: string,
  logger: ReturnType<typeof MemoryLogger.create>,
  options: RenderOptions,
): Promise<{ converted: string; outcomes: PlantUmlOutcome[] }> => {
  const diagram = beginDiagramRender();
  let converted: unknown;
  let requests: PlantUmlRequest[] = [];

  try {
    converted = await convert(source, {
      safe: 'safe',
      standalone: true,
      logger,
      extension_registry: diagram.registry,
      attributes: { 'adoc-diagram-render-id': diagram.renderId },
    });
  } finally {
    requests = diagram.take();
  }

  if (typeof converted !== 'string') {
    throw new Error('Asciidoctor did not return HTML');
  }

  const outcomes = await renderDiagramRequests(requests, diagramContext(options));
  return { converted, outcomes };
};

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
  '.adoc-puml',
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
  options: RenderOptions = {},
): Promise<RenderResult> {
  const { idPrefix = 'doc' } = options;
  const logger = MemoryLogger.create();
  const { converted, outcomes } = await convertWithDiagrams(
    source,
    logger,
    options,
  );

  const doc = new DOMParser().parseFromString(converted, 'text/html');
  const blocks: RenderBlock[] = [];

  const pushBlock = (element: Element, kind: BlockKind) => {
    const clean = sanitizeHtml(element.outerHTML);
    // Diagram source is part of the key, so an edited `.puml` file counts as
    // a change even when the macro line is unchanged.
    const keyHtml = diagramKeyHtml(clean, outcomes);
    const keyExtra = diagramKeyExtra(clean, outcomes);
    const hydrated = hydrateDiagramHtml(clean, outcomes);

    blocks.push({
      id: `${idPrefix}-block-${blocks.length}`,
      kind,
      html: prefixHtmlIds(hydrated, idPrefix),
      key: `${kind}\u0000${keyHtml.trim()}${keyExtra}`,
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

  const warnings = [...collectWarnings(logger), ...diagramWarnings(outcomes)];

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
  options: RenderOptions = {},
): Promise<PreviewResult> {
  const logger = MemoryLogger.create();
  const { converted, outcomes } = await convertWithDiagrams(
    source,
    logger,
    options,
  );

  const doc = new DOMParser().parseFromString(converted, 'text/html');
  const header = doc.getElementById('header');
  const content = doc.getElementById('content');

  // The document title lives in `#header`, not in `#content`; the preview must
  // show it, otherwise a `= Title` line silently disappears from the page.
  const raw = `${header ? header.innerHTML : ''}${
    content ? content.innerHTML : doc.body.innerHTML
  }`;

  return {
    html: hydrateDiagramHtml(sanitizeHtml(raw), outcomes),
    warnings: [...collectWarnings(logger), ...diagramWarnings(outcomes)],
  };
}
