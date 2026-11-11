import DOMPurify, { type DOMPurify as Purifier } from 'dompurify';

let purifier: Purifier | null = null;

const getPurifier = (): Purifier => {
  if (!purifier) {
    if (typeof window === 'undefined') {
      throw new Error('SVG sanitization requires a browser DOM');
    }
    purifier = DOMPurify(window);
  }
  return purifier;
};

/**
 * Sanitizes SVG returned by Kroki before it is embedded as a data URL.
 *
 * The image is loaded through `<img>`, where scripts do not execute, but the
 * SVG still passes through DOMPurify as defence in depth: scripts, foreign
 * objects and external `xlink:href` links are removed. PlantUML uses inline
 * styles and `<style>` blocks, which DOMPurify's SVG profile keeps.
 */
export function sanitizeSvg(svg: string): string {
  return getPurifier().sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['xlink:href'],
  });
}
