import { Extensions } from '@asciidoctor/core';

import type { PlantUmlFormat, PlantUmlRequest } from './types.js';

const ATTRIBUTE_RENDER_ID = 'adoc-diagram-render-id';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

const attributeValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeFormat = (value: unknown): PlantUmlFormat =>
  attributeValue(value)?.toLowerCase() === 'png' ? 'png' : 'svg';

const lineNumber = (parent: unknown): number | null => {
  try {
    const value = (parent as { getLineNumber?: () => number | undefined })
      .getLineNumber?.();
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
};

const placeholderHtml = (request: PlantUmlRequest): string =>
  `<div class="adoc-puml adoc-puml--pending" id="${request.id}">` +
  `<pre class="adoc-puml__source">${escapeHtml(
    `plantuml::${request.target}[]`,
  )}</pre>` +
  '</div>';

const unresolvedHtml = (target: string): string =>
  `<div class="adoc-puml adoc-puml--unresolved">` +
  `<pre class="adoc-puml__source">${escapeHtml(
    `plantuml::${target}[]`,
  )}</pre>` +
  '</div>';

/**
 * Requests are grouped by render id so the live preview and both diff sides
 * can run concurrently without mixing their diagrams.
 */
const requestsByRender = new Map<string, PlantUmlRequest[]>();

let renderCounter = 0;
let registry: ReturnType<typeof Extensions.create> | null = null;

const getRegistry = (): ReturnType<typeof Extensions.create> => {
  if (registry) return registry;

  // A group block is re-executed on every registry activation, so the
  // registry stays valid for all subsequent `convert` calls.
  registry = Extensions.create('ascii-wysiwyg-diagrams', function (this: any) {
    this.blockMacro(function (this: any) {
      this.named('plantuml');

      this.process(
        function (
          this: any,
          parent: any,
          target: string,
          attrs?: Record<string, unknown>,
        ) {
          const attributes = attrs ?? {};
          const document = parent?.document ?? parent?.getDocument?.();
          const rawRenderId = document?.getAttribute?.(ATTRIBUTE_RENDER_ID);
          const renderId =
            typeof rawRenderId === 'string' ? rawRenderId : null;
          const requests = renderId
            ? requestsByRender.get(renderId)
            : undefined;

          if (!renderId || !requests) {
            // Someone called `convert` without our render context: keep the
            // macro visible instead of silently dropping the block.
            return this.createPassBlock(parent, unresolvedHtml(String(target)));
          }

          const request: PlantUmlRequest = {
            id: `${renderId}-puml-${requests.length}`,
            target: String(target),
            format: normalizeFormat(attributes.format),
            title: attributeValue(attributes.title),
            alt: attributeValue(attributes.alt),
            line: lineNumber(parent),
          };

          requests.push(request);
          return this.createPassBlock(parent, placeholderHtml(request));
        },
      );
    });
  });

  return registry;
};

export interface DiagramRenderHandle {
  renderId: string;
  registry: ReturnType<typeof Extensions.create>;
  /** Unregisters the render and returns every macro seen during it. */
  take: () => PlantUmlRequest[];
}

/**
 * Starts one conversion. The render id is passed to Asciidoctor as a document
 * attribute; the `plantuml` block macro appends its requests to this handle.
 */
export function beginDiagramRender(): DiagramRenderHandle {
  renderCounter += 1;
  const renderId = `diagram-${renderCounter}`;
  const requests: PlantUmlRequest[] = [];
  requestsByRender.set(renderId, requests);

  return {
    renderId,
    registry: getRegistry(),
    take: () => {
      requestsByRender.delete(renderId);
      return requests;
    },
  };
}
