import type { PreviewResult } from '../../asciidoc-diff/model/render.js';
import type { RenderOptions } from '../../asciidoc-diff/model/render.js';

export type { PreviewResult };

/**
 * Renders AsciiDoc for the live preview. `@asciidoctor/core` is loaded lazily
 * so the first paint does not pay for the converter.
 */
export async function renderPreview(
  source: string,
  options: RenderOptions = {},
): Promise<PreviewResult> {
  const { renderAsciiDocPreview } = await import(
    '../../asciidoc-diff/model/render.js'
  );
  return renderAsciiDocPreview(source, options);
}
