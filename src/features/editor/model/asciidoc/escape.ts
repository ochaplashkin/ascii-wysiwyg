/**
 * Escaping helpers for AsciiDoc serialization.
 *
 * Every function is pure and DOM-free so it can be unit-tested in Node.
 */

const BLOCK_MARKER_WITH_SPACE = /^(?:\*+|\.+|-+|=+)(?=\s|$)/;
const BLOCK_MARKER_ALWAYS = /^[|:\[]/;

/**
 * Escape a line that would otherwise be parsed as a block marker by AsciiDoc
 * (a list item, attribute entry, block title, comment, etc.).
 *
 * A marker only needs escaping when it really is a block marker: `**bold**`
 * at the start of a paragraph must stay bold, while `* item` must not become
 * a list. List markers are therefore recognised only when followed by
 * whitespace (or the end of the line).
 */
export function escapeBlockMarkers(line: string): string {
  if (line.length === 0 || line.startsWith('\\')) {
    return line;
  }

  if (
    line.startsWith('//') ||
    BLOCK_MARKER_ALWAYS.test(line) ||
    BLOCK_MARKER_WITH_SPACE.test(line)
  ) {
    return `\\${line}`;
  }

  return line;
}

/** Escape a backslash so it is rendered literally in AsciiDoc. */
export function escapeBackslashes(text: string): string {
  return text.replace(/\\/g, '\\\\');
}

export interface InlineEscapeOptions {
  /** Escape pipe characters because the text is inside a table cell. */
  table?: boolean;
  /**
   * The active cell separator of the table. Top-level tables use `|`, nested
   * tables use `!`. The separator must be escaped inside cell content so it is
   * not parsed as the start of the next cell.
   */
  delimiter?: string | undefined;
}

/**
 * Escape inline text. Backslashes are always escaped; pipe characters can be
 * escaped too when the text ends up inside a table cell. For nested tables the
 * active `!` cell separator is escaped as well.
 */
export function escapeInlineText(
  text: string,
  options: InlineEscapeOptions = {},
): string {
  let result = escapeBackslashes(text);
  if (options.table) {
    result = result.replace(/\|/g, '\\|');
  }
  if (options.delimiter && options.delimiter !== '|') {
    result = result.replace(
      new RegExp(options.delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      `\\${options.delimiter}`,
    );
  }
  return result;
}

/** Longest run of dashes in a string (used to pick a safe code-block fence). */
export function longestDashRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/-+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

/** A fence longer than any dash run in the code, minimum four dashes. */
export function codeFence(code: string): string {
  return '-'.repeat(Math.max(4, longestDashRun(code) + 1));
}
