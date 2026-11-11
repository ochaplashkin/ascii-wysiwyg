/** `.puml` sources are sent to Kroki; keep a conservative size limit. */
export const MAX_DIAGRAM_SOURCE_CHARS = 256 * 1024;

/**
 * Directory part of a picked-folder path (`diagrams/a.adoc` -> `diagrams`).
 * Paths are always relative and use `/`; an empty string is the folder root.
 */
export function dirnamePath(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolve a macro target against the document directory without ever escaping
 * the picked folder. Returns a normalized relative path, or `null` for
 * absolute/remote targets and `..` traversal above the root.
 */
export function resolveDiagramPath(
  baseDir: string,
  target: string,
): string | null {
  const raw = target.trim().replace(/\\/g, '/');
  if (raw.length === 0) return null;
  if (raw.includes('\0')) return null;
  if (SCHEME_RE.test(raw) || raw.startsWith('/')) return null;

  const segments = baseDir
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0);

  // A target consisting only of `.`/`..` points at a directory, not at a
  // diagram file, so it is rejected as well.
  let hasFileSegment = false;

  for (const part of raw.split('/')) {
    if (part.length === 0 || part === '.') continue;

    if (part === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }

    segments.push(part);
    hasFileSegment = true;
  }

  return hasFileSegment && segments.length > 0 ? segments.join('/') : null;
}
