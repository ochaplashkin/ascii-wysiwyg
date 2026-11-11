import type { EditorMark, EditorNode } from '../../editor/types.js';

/**
 * AsciiDoc -> Tiptap importer.
 *
 * The parser understands the subset of AsciiDoc that `serializeAsciiDoc`
 * produces, so serializer output round-trips byte for byte. Everything else is
 * preserved verbatim in a `rawAsciiDoc` block instead of being dropped.
 *
 * The implementation is pure: no DOM, no AsciiDoc runtime, no dependencies.
 */

export interface ImportWarning {
  kind: 'raw';
  /** First line of the raw fragment, for the UI banner. */
  preview: string;
  /** 1-based line number in the source. */
  line: number;
}

export interface ParseResult {
  title: string;
  doc: EditorNode;
  warnings: ImportWarning[];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function parseAsciiDoc(source: string): ParseResult {
  const normalized = source.replace(/\r\n?/g, '\n');

  try {
    return parseNormalized(normalized);
  } catch {
    // The parser is defensive, but a malformed document must never break the
    // editor: fall back to one raw block containing the whole source.
    return fallbackResult(normalized);
  }
}

function parseNormalized(source: string): ParseResult {
  const lines = source.split('\n');
  const warnings: ImportWarning[] = [];
  let start = 0;

  while (start < lines.length && isBlank(lines[start]!)) {
    start++;
  }

  let title = '';
  if (start < lines.length) {
    // A document title is exactly one leading `=`; `==` and deeper are headings.
    const titleMatch = /^=\s+(\S.*)$/.exec(lines[start]!);
    if (titleMatch) {
      title = titleMatch[1]!.trim();
      start++;
      while (start < lines.length && isBlank(lines[start]!)) {
        start++;
      }
    }
  }

  const parsed = parseBlocks(lines, start, lines.length, warnings);

  return {
    title,
    doc: { type: 'doc', content: parsed.nodes },
    warnings,
  };
}

function fallbackResult(source: string): ParseResult {
  const text = source.replace(/\n+$/, '');
  if (text.length === 0) {
    return { title: '', doc: { type: 'doc', content: [] }, warnings: [] };
  }

  return {
    title: '',
    doc: {
      type: 'doc',
      content: [{ type: 'rawAsciiDoc', attrs: { text } }],
    },
    warnings: [{ kind: 'raw', preview: firstLine(text), line: 1 }],
  };
}

// ---------------------------------------------------------------------------
// Line helpers
// ---------------------------------------------------------------------------

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim();
}

/** True when `line` is a run of at least `minimum` copies of `char`. */
function isRunOf(line: string, char: string, minimum: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < minimum) {
    return false;
  }
  for (const value of trimmed) {
    if (value !== char) {
      return false;
    }
  }
  return true;
}

function isTableDelimiterLine(line: string): boolean {
  return /^[|!]={3,}$/.test(line.trim());
}

function isAttributeLine(line: string): boolean {
  return /^\[[^\]]*\]\s*$/.test(line.trim());
}

interface DelimiterLine {
  char: string;
  length: number;
}

/** `----`, `....`, `____`, `====`, `****`, `++++`, `////`. */
function matchDelimiterLine(line: string): DelimiterLine | null {
  const trimmed = line.trim();
  if (trimmed.length < 4) {
    return null;
  }
  const char = trimmed.charAt(0);
  if (!'_-=.*+/'.includes(char)) {
    return null;
  }
  for (const value of trimmed) {
    if (value !== char) {
      return null;
    }
  }
  return { char, length: trimmed.length };
}

function findRunClose(
  lines: string[],
  from: number,
  end: number,
  char: string,
  minimum: number,
): number {
  for (let i = from; i < end; i++) {
    if (isRunOf(lines[i]!, char, minimum)) {
      return i;
    }
  }
  return -1;
}

/** Find a table delimiter such as `|===` or `!===`. */
function findTableClose(
  lines: string[],
  from: number,
  end: number,
  delimiter: string,
  minimum: number,
): number {
  for (let i = from; i < end; i++) {
    const trimmed = lines[i]!.trim();
    if (
      trimmed.length >= minimum &&
      trimmed.startsWith(delimiter) &&
      /^={3,}$/.test(trimmed.slice(1))
    ) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

interface BlockResult {
  node: EditorNode;
  next: number;
}

type StopPredicate = (line: string, index: number) => boolean;

function parseBlocks(
  lines: string[],
  start: number,
  end: number,
  warnings: ImportWarning[],
  stop?: StopPredicate,
): { nodes: EditorNode[]; next: number } {
  const nodes: EditorNode[] = [];
  let i = start;

  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line)) {
      i++;
      continue;
    }
    if (stop?.(line, i)) {
      break;
    }

    const result = parseBlockAt(lines, i, end, warnings, stop);
    nodes.push(result.node);
    i = result.next;
  }

  return { nodes, next: i };
}

function parseBlockAt(
  lines: string[],
  index: number,
  end: number,
  warnings: ImportWarning[],
  stop?: StopPredicate,
): BlockResult {
  const line = lines[index]!;

  // Headings (== .. ======) map to levels 1..5.
  const heading = /^(={2,6})\s+(\S.*)$/.exec(line);
  if (heading) {
    const level = Math.min(5, Math.max(1, heading[1]!.length - 1));
    return {
      node: {
        type: 'heading',
        attrs: { level },
        content: parseInline(heading[2]!.trim()),
      },
      next: index + 1,
    };
  }

  if (line.trim() === "'''") {
    return { node: { type: 'horizontalRule' }, next: index + 1 };
  }

  if (isAttributeLine(line)) {
    const attributeEnd = collectAttributeEnd(lines, index, end);
    const attributeText = lines.slice(index, attributeEnd).join(' ');
    const nextLine = attributeEnd < end ? lines[attributeEnd]! : '';

    if (isQuoteAttribute(attributeText) && isRunOf(nextLine, '_', 4)) {
      return parseQuote(lines, index, attributeEnd, end, warnings);
    }

    const source = sourceAttribute(attributeText);
    if (
      source.isSource &&
      (isRunOf(nextLine, '-', 4) || isRunOf(nextLine, '.', 4))
    ) {
      return parseCodeBlock(
        lines,
        index,
        attributeEnd,
        end,
        source.language,
        warnings,
      );
    }

    if (isTableDelimiterLine(nextLine)) {
      return parseTableBlock(
        lines,
        index,
        attributeEnd,
        end,
        warnings,
        hasHeaderOption(attributeText),
        tableColumnCount(attributeText),
      );
    }

    // Attribute on an unknown delimited block: keep the whole fragment raw.
    if (matchDelimiterLine(nextLine)) {
      const delimiter = matchDelimiterLine(nextLine)!;
      const close = findRunClose(
        lines,
        attributeEnd + 1,
        end,
        delimiter.char,
        delimiter.length,
      );
      const rawEnd = close === -1 ? end : close + 1;
      return {
        node: makeRaw(lines, index, rawEnd, warnings),
        next: rawEnd,
      };
    }

    // Unknown attribute line(s): raw.
    const rawEnd = collectUnknownEnd(lines, index, end);
    return { node: makeRaw(lines, index, rawEnd, warnings), next: rawEnd };
  }

  const listItem = matchListItem(line);
  if (listItem) {
    return parseList(lines, index, end, warnings);
  }

  if (isTableDelimiterLine(line)) {
    return parseTableBlock(lines, index, index, end, warnings, false, null);
  }

  const delimiter = matchDelimiterLine(line);
  if (delimiter) {
    if (delimiter.char === '-' || delimiter.char === '.') {
      return parseCodeBlock(lines, index, index, end, '', warnings);
    }

    const close = findRunClose(
      lines,
      index + 1,
      end,
      delimiter.char,
      delimiter.length,
    );
    const rawEnd = close === -1 ? end : close + 1;
    return { node: makeRaw(lines, index, rawEnd, warnings), next: rawEnd };
  }

  const unknownEnd = collectUnknownEnd(lines, index, end);
  if (unknownEnd > index) {
    return { node: makeRaw(lines, index, unknownEnd, warnings), next: unknownEnd };
  }

  return parseParagraph(lines, index, end, stop);
}

function collectAttributeEnd(lines: string[], start: number, end: number): number {
  let i = start;
  while (i < end && isAttributeLine(lines[i]!)) {
    i++;
  }
  return i;
}

function isQuoteAttribute(text: string): boolean {
  return /\[quote(?:[,\s][^\]]*)?\]/i.test(text);
}

function sourceAttribute(text: string): { isSource: boolean; language: string } {
  const match = /\[source(?:[,\s]+([^,\]\s]+))?[^\]]*\]/i.exec(text);
  if (!match) {
    return { isSource: false, language: '' };
  }
  return { isSource: true, language: (match[1] ?? '').trim() };
}

function hasHeaderOption(text: string): boolean {
  return (
    /options\s*=\s*["']?[^"'\]]*header/i.test(text) || /%header\b/i.test(text)
  );
}

/**
 * Number of columns declared by a `cols="..."` attribute, or null when the
 * attribute is absent (the first row line then determines the column count).
 */
function tableColumnCount(text: string): number | null {
  const match = /cols\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\]\s]+))/i.exec(text);
  if (!match) {
    return null;
  }

  const spec = match[1] ?? match[2] ?? match[3] ?? '';
  let count = 0;
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const repeat = /^(\d+)\*$/.exec(trimmed);
    count += repeat ? Math.max(1, Number(repeat[1])) : 1;
  }

  return count > 0 ? count : null;
}

// -- paragraphs -------------------------------------------------------------

function parseParagraph(
  lines: string[],
  start: number,
  end: number,
  stop?: StopPredicate,
): BlockResult {
  let i = start + 1;
  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line)) {
      break;
    }
    if (isBlockStart(lines, i, end, stop)) {
      break;
    }
    i++;
  }

  const content = parseParagraphLines(lines.slice(start, i));
  return { node: { type: 'paragraph', content }, next: i };
}

function parseParagraphLines(lines: string[]): EditorNode[] {
  const content: EditorNode[] = [];

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index]!;
    const hardBreak = line.endsWith(' +');
    if (hardBreak) {
      line = line.slice(0, -2);
    }

    content.push(...parseInline(line));

    if (index < lines.length - 1) {
      content.push(
        hardBreak ? { type: 'hardBreak' } : { type: 'text', text: ' ' },
      );
    }
  }

  return content;
}

function isBlockStart(
  lines: string[],
  index: number,
  end: number,
  stop?: StopPredicate,
): boolean {
  const line = lines[index]!;
  if (isBlank(line)) {
    return false;
  }
  if (stop?.(line, index)) {
    return true;
  }
  if (/^(={2,6})\s+(\S.*)$/.test(line) || line.trim() === "'''") {
    return true;
  }
  if (isAttributeLine(line) || matchListItem(line) !== null) {
    return true;
  }
  if (isTableDelimiterLine(line) || matchDelimiterLine(line) !== null) {
    return true;
  }
  return unknownLineKind(line) !== null;
}

// -- quote / code -----------------------------------------------------------

function parseQuote(
  lines: string[],
  start: number,
  delimiterIndex: number,
  end: number,
  warnings: ImportWarning[],
): BlockResult {
  const close = findRunClose(lines, delimiterIndex + 1, end, '_', 4);
  if (close === -1) {
    return { node: makeRaw(lines, start, end, warnings), next: end };
  }

  const inner = parseBlocks(lines, delimiterIndex + 1, close, warnings);
  return {
    node: { type: 'blockquote', content: inner.nodes },
    next: close + 1,
  };
}

function parseCodeBlock(
  lines: string[],
  start: number,
  fenceIndex: number,
  end: number,
  language: string,
  warnings: ImportWarning[],
): BlockResult {
  const fenceLine = lines[fenceIndex]!;
  const char = fenceLine.trim().charAt(0);
  const length = fenceLine.trim().length;
  const close = findRunClose(lines, fenceIndex + 1, end, char, length);
  if (close === -1) {
    return { node: makeRaw(lines, start, end, warnings), next: end };
  }

  const code = lines.slice(fenceIndex + 1, close).join('\n');
  const content: EditorNode[] =
    code.length > 0 ? [{ type: 'text', text: code }] : [];

  return {
    node: { type: 'codeBlock', attrs: { language }, content },
    next: close + 1,
  };
}

// -- tables -----------------------------------------------------------------

function parseTableBlock(
  lines: string[],
  start: number,
  delimiterIndex: number,
  end: number,
  warnings: ImportWarning[],
  header: boolean,
  columns: number | null,
): BlockResult {
  const opening = lines[delimiterIndex]!.trim();
  const delimiter = opening.startsWith('!') ? '!' : '|';
  const minimum = opening.length;
  const close = findTableClose(lines, delimiterIndex + 1, end, delimiter, minimum);

  if (close === -1) {
    return { node: makeRaw(lines, start, end, warnings), next: end };
  }

  const table = parseTableBody(
    lines,
    delimiterIndex + 1,
    close,
    warnings,
    delimiter,
    header,
    columns,
  );

  if (table === null) {
    // A table row we cannot understand: keep the original source intact.
    return {
      node: makeRaw(lines, start, close + 1, warnings),
      next: close + 1,
    };
  }

  return { node: table, next: close + 1 };
}

interface CellStart {
  colspan: number;
  rowspan: number;
  asciidoc: boolean;
  rest: string;
}

const CELL_START_RE = /^(?:(\d+)?(?:\.(\d+))?\+)?(a)?([|!])(.*)$/;

function matchCellStart(line: string, delimiter: string): CellStart | null {
  const match = CELL_START_RE.exec(line);
  if (!match || match[4] !== delimiter) {
    return null;
  }
  return {
    colspan: positiveInteger(match[1]),
    rowspan: positiveInteger(match[2]),
    asciidoc: match[3] === 'a',
    rest: match[5] ?? '',
  };
}

function positiveInteger(value: string | undefined): number {
  if (value === undefined) {
    return 1;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function parseTableBody(
  lines: string[],
  start: number,
  end: number,
  warnings: ImportWarning[],
  delimiter: string,
  header: boolean,
  columns: number | null,
): EditorNode | null {
  // A "row group" is a run of cell lines not separated by a blank line.
  // Asciidoctor wraps cells from the same group into rows using the column
  // count, which is how `| A | B` / `| 1 | 2` becomes two rows of two cells.
  // Serializer output already separates rows with blank lines, so each group
  // there contains exactly one row.
  const groups: EditorNode[][] = [];
  let group: EditorNode[] = [];
  let firstLineWidth: number | null = null;
  let i = start;

  const finalizeGroup = (): void => {
    if (group.length > 0) {
      groups.push(group);
      group = [];
    }
  };

  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line)) {
      finalizeGroup();
      i++;
      continue;
    }

    if (!matchCellStart(line, delimiter)) {
      return null;
    }

    const firstLine =
      groups.length === 0 && group.length === 0 && firstLineWidth === null;
    const cellResult = parseCell(lines, i, end, warnings, delimiter);
    if (cellResult === null) {
      return null;
    }

    if (firstLine) {
      firstLineWidth = cellResult.cells.reduce(
        (total, cell) => total + cellSpan(cell),
        0,
      );
    }

    group.push(...cellResult.cells);
    i = cellResult.next;
    if (cellResult.rowBreak) {
      finalizeGroup();
    }
  }

  finalizeGroup();

  const columnCount = columns ?? Math.max(1, firstLineWidth ?? 1);
  const rows = chunkTableRows(groups, columnCount);

  const content = rows.map((cells, rowIndex) => ({
    type: 'tableRow',
    content:
      header && rowIndex === 0
        ? cells.map((cell) => ({ ...cell, type: 'tableHeader' }))
        : cells,
  }));

  return { type: 'table', content };
}

/** Split a run of cells into rows of `columnCount` columns (spans respected). */
function chunkTableRows(
  groups: EditorNode[][],
  columnCount: number,
): EditorNode[][] {
  const rows: EditorNode[][] = [];

  for (const group of groups) {
    let row: EditorNode[] = [];
    let used = 0;

    for (const cell of group) {
      const span = cellSpan(cell);
      if (row.length > 0 && used + span > columnCount) {
        rows.push(row);
        row = [];
        used = 0;
      }

      row.push(cell);
      used += span;

      if (used >= columnCount) {
        rows.push(row);
        row = [];
        used = 0;
      }
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function cellSpan(cell: EditorNode): number {
  const value = cell.attrs?.colspan;
  const span = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(span) && span >= 1 ? Math.floor(span) : 1;
}


function parseCell(
  lines: string[],
  index: number,
  end: number,
  warnings: ImportWarning[],
  delimiter: string,
): { cells: EditorNode[]; next: number; rowBreak: boolean } | null {
  const start = matchCellStart(lines[index]!, delimiter);
  if (!start) {
    return null;
  }

  if (start.asciidoc) {
    return parseAsciiDocCell(lines, index, end, warnings, delimiter, start);
  }

  const parts = splitUnescaped(start.rest, delimiter);
  const continuation: string[] = [];
  let next = index + 1;

  while (next < end) {
    const line = lines[next]!;
    if (isBlank(line) || matchCellStart(line, delimiter)) {
      break;
    }
    continuation.push(line);
    next++;
  }

  const cells: EditorNode[] = parts.map((part, partIndex) => {
    const contentParts = [part];
    if (partIndex === parts.length - 1) {
      contentParts.push(...continuation);
    }
    return makeCellNode(
      partIndex === 0 ? start : DEFAULT_CELL_START,
      [makeCellParagraph(contentParts.join('\n'))],
    );
  });

  return { cells, next, rowBreak: false };
}

const DEFAULT_CELL_START: CellStart = {
  colspan: 1,
  rowspan: 1,
  asciidoc: false,
  rest: '',
};

function makeCellParagraph(value: string): EditorNode {
  const normalized = stripLeadingSpace(value).trimEnd();
  const segments = normalized.split(/ \+\n|\n/);
  const content: EditorNode[] = [];

  segments.forEach((segment, index) => {
    if (index > 0) {
      content.push({ type: 'hardBreak' });
    }
    content.push(...parseInline(segment));
  });

  return content.length > 0
    ? { type: 'paragraph', content }
    : { type: 'paragraph' };
}

function parseAsciiDocCell(
  lines: string[],
  index: number,
  end: number,
  warnings: ImportWarning[],
  delimiter: string,
  start: CellStart,
): { cells: EditorNode[]; next: number; rowBreak: boolean } {
  let next = index + 1;
  while (next < end) {
    const line = lines[next]!;
    if (matchCellStart(line, delimiter)) {
      break;
    }
    next++;
  }

  let contentEnd = next;
  let rowBreak = false;
  while (contentEnd > index + 1 && isBlank(lines[contentEnd - 1]!)) {
    contentEnd--;
    rowBreak = true;
  }

  const content: EditorNode[] = [];
  const inlineText = stripLeadingSpace(start.rest).trimEnd();
  if (inlineText.length > 0) {
    content.push({ type: 'paragraph', content: parseInline(inlineText) });
  }

  let blockStart = index + 1;
  while (blockStart < contentEnd && isBlank(lines[blockStart]!)) {
    blockStart++;
  }

  if (blockStart < contentEnd) {
    const parsed = parseBlocks(
      lines,
      blockStart,
      contentEnd,
      warnings,
      (line) => matchCellStart(line, delimiter) !== null,
    );
    content.push(...parsed.nodes);
  }

  return {
    cells: [makeCellNode(start, content)],
    next,
    rowBreak,
  };
}

function makeCellNode(start: CellStart, content: EditorNode[]): EditorNode {
  const attrs: Record<string, unknown> = {};
  if (start.colspan > 1) {
    attrs.colspan = start.colspan;
  }
  if (start.rowspan > 1) {
    attrs.rowspan = start.rowspan;
  }

  return {
    type: 'tableCell',
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    content,
  };
}

function stripLeadingSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}

/** Split on the active cell delimiter, keeping escaped delimiters intact. */
function splitUnescaped(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < value.length) {
    const char = value[i]!;
    if (char === '\\' && i + 1 < value.length) {
      current += char + value[i + 1]!;
      i += 2;
      continue;
    }
    if (char === delimiter) {
      parts.push(current);
      current = '';
      i++;
      continue;
    }
    current += char;
    i++;
  }

  parts.push(current);
  return parts;
}

// -- lists ------------------------------------------------------------------

type ListKind = 'bullet' | 'ordered' | 'task';

interface ListItemMatch {
  depth: number;
  kind: ListKind;
  checked: boolean;
  text: string;
}

const TASK_ITEM_RE = /^(\*+)\s+\[([ xX])\](?:\s+(.*))?$/;
const BULLET_ITEM_RE = /^(\*+)(?:\s+(.*))?$/;
const ORDERED_ITEM_RE = /^(\.+)(?:\s+(.*))?$/;

function matchListItem(line: string): ListItemMatch | null {
  const task = TASK_ITEM_RE.exec(line);
  if (task) {
    return {
      depth: task[1]!.length,
      kind: 'task',
      checked: task[2]!.toLowerCase() === 'x',
      text: task[3] ?? '',
    };
  }

  const bullet = BULLET_ITEM_RE.exec(line);
  if (bullet) {
    return {
      depth: bullet[1]!.length,
      kind: 'bullet',
      checked: false,
      text: bullet[2] ?? '',
    };
  }

  const ordered = ORDERED_ITEM_RE.exec(line);
  if (ordered) {
    return {
      depth: ordered[1]!.length,
      kind: 'ordered',
      checked: false,
      text: ordered[2] ?? '',
    };
  }

  return null;
}

function listNodeType(kind: ListKind): string {
  if (kind === 'ordered') {
    return 'orderedList';
  }
  return kind === 'task' ? 'taskList' : 'bulletList';
}

interface ListLevel {
  markerDepth: number;
  kind: ListKind;
  list: EditorNode;
  lastItem: EditorNode | null;
}

function parseList(
  lines: string[],
  start: number,
  end: number,
  warnings: ImportWarning[],
): BlockResult {
  const first = matchListItem(lines[start]!);
  if (!first) {
    return {
      node: makeRaw(lines, start, start + 1, warnings),
      next: start + 1,
    };
  }

  const root: EditorNode = { type: listNodeType(first.kind), content: [] };
  const stack: ListLevel[] = [
    {
      markerDepth: first.depth,
      kind: first.kind,
      list: root,
      lastItem: null,
    },
  ];

  let i = start;
  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line)) {
      break;
    }

    if (line === '+') {
      const current = stack[stack.length - 1]?.lastItem;
      if (!current) {
        break;
      }

      const continuation = parseContinuation(lines, i + 1, end, warnings);
      appendChildren(current, continuation.nodes);
      i = continuation.next > i + 1 ? continuation.next : i + 1;
      continue;
    }

    const item = matchListItem(line);
    if (!item) {
      break;
    }

    while (stack.length > 1 && item.depth < stack[stack.length - 1]!.markerDepth) {
      stack.pop();
    }

    let level = stack[stack.length - 1]!;
    if (item.depth === level.markerDepth) {
      if (item.kind !== level.kind) {
        break;
      }
    } else if (item.depth > level.markerDepth) {
      if (!level.lastItem) {
        break;
      }
      const nested: EditorNode = { type: listNodeType(item.kind), content: [] };
      appendChildren(level.lastItem, [nested]);
      const nestedLevel: ListLevel = {
        markerDepth: item.depth,
        kind: item.kind,
        list: nested,
        lastItem: null,
      };
      stack.push(nestedLevel);
      level = nestedLevel;
    } else {
      // Outdented below the first marker of this list: a different block.
      break;
    }

    const node = makeListItem(item);
    level.list.content = [...(level.list.content ?? []), node];
    level.lastItem = node;
    i++;

    // A list item paragraph can contain hard breaks: `* first +\nsecond`.
    // Those continuation lines belong to the same item paragraph.
    if (item.text.endsWith(' +')) {
      const extra: string[] = [];
      while (i < end) {
        const nextLine = lines[i]!;
        if (
          isBlank(nextLine) ||
          nextLine === '+' ||
          matchListItem(nextLine) !== null ||
          isBlockStart(lines, i, end)
        ) {
          break;
        }
        extra.push(nextLine);
        i++;
      }

      const paragraph = node.content?.[0];
      if (extra.length > 0 && paragraph?.type === 'paragraph') {
        paragraph.content = parseParagraphLines([item.text, ...extra]);
      }
    }
  }

  return { node: root, next: i };
}

function makeListItem(item: ListItemMatch): EditorNode {
  const content: EditorNode[] =
    item.text.length > 0
      ? [{ type: 'paragraph', content: parseInline(item.text) }]
      : [];

  if (item.kind === 'task') {
    return { type: 'taskItem', attrs: { checked: item.checked }, content };
  }

  return { type: 'listItem', content };
}

function appendChildren(node: EditorNode, children: EditorNode[]): void {
  if (children.length === 0) {
    return;
  }
  node.content = [...(node.content ?? []), ...children];
}

function parseContinuation(
  lines: string[],
  start: number,
  end: number,
  warnings: ImportWarning[],
): { nodes: EditorNode[]; next: number } {
  if (start >= end || isBlank(lines[start]!)) {
    return { nodes: [], next: start };
  }

  if (isBlockStart(lines, start, end)) {
    const block = parseBlockAt(lines, start, end, warnings);
    return { nodes: [block.node], next: block.next };
  }

  let i = start;
  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line) || line === '+') {
      break;
    }
    if (i > start && isBlockStart(lines, i, end)) {
      break;
    }
    i++;
  }

  const content = parseParagraphLines(lines.slice(start, i));
  return {
    nodes: content.length > 0 ? [{ type: 'paragraph', content }] : [],
    next: i,
  };
}

// ---------------------------------------------------------------------------
// Unknown / raw AsciiDoc
// ---------------------------------------------------------------------------

type UnknownKind = 'admonition' | 'line';

function unknownLineKind(line: string): UnknownKind | null {
  if (/^\/\//.test(line)) {
    return 'line';
  }
  if (/^:[^:\s][^:]*:/.test(line)) {
    return 'line';
  }
  if (/^(?:include|image)::/.test(line)) {
    return 'line';
  }
  if (/^(?:ifdef|ifndef|endif|ifeval)::/.test(line)) {
    return 'line';
  }
  if (/^(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION):(?:\s|$)/i.test(line)) {
    return 'admonition';
  }
  if (/^\[\[/.test(line)) {
    return 'line';
  }
  if (/^\.\S/.test(line)) {
    return 'line';
  }
  if (isAttributeLine(line)) {
    return 'line';
  }
  return null;
}

/**
 * Consume a run of unknown lines. Admonitions swallow their continuation lines
 * (they are one paragraph in AsciiDoc); other constructs stop at the first
 * line that the parser does understand.
 */
function collectUnknownEnd(lines: string[], start: number, end: number): number {
  const kind = unknownLineKind(lines[start]!);
  if (!kind) {
    return start;
  }

  let i = start + 1;

  if (kind === 'admonition') {
    while (i < end && !isBlank(lines[i]!)) {
      i++;
    }
    return i;
  }

  while (i < end) {
    const line = lines[i]!;
    if (isBlank(line) || unknownLineKind(line) === null) {
      break;
    }
    i++;
  }

  return i;
}

function makeRaw(
  lines: string[],
  start: number,
  end: number,
  warnings: ImportWarning[],
): EditorNode {
  const text = lines.slice(start, end).join('\n').replace(/\n+$/, '');
  warnings.push({ kind: 'raw', preview: firstLine(text), line: start + 1 });
  return { type: 'rawAsciiDoc', attrs: { text } };
}

// ---------------------------------------------------------------------------
// Inline parsing
// ---------------------------------------------------------------------------

interface AttributeMark {
  prefix: string;
  type: string;
}

const ATTRIBUTE_MARKS: AttributeMark[] = [
  { prefix: '[.underline]#', type: 'underline' },
  { prefix: '[.line-through]#', type: 'strike' },
  { prefix: '[.highlight]#', type: 'highlight' },
];

function parseInline(text: string, marks: EditorMark[] = []): EditorNode[] {
  const nodes: EditorNode[] = [];
  let buffer = '';
  let i = 0;

  const flush = (): void => {
    if (buffer.length > 0) {
      nodes.push(makeTextNode(buffer, marks));
      buffer = '';
    }
  };

  while (i < text.length) {
    const char = text[i]!;

    if (char === '\\') {
      const next = text[i + 1];
      if (next !== undefined) {
        buffer += next;
        i += 2;
      } else {
        buffer += '\\';
        i++;
      }
      continue;
    }

    let matched = false;

    for (const attributeMark of ATTRIBUTE_MARKS) {
      if (!text.startsWith(attributeMark.prefix, i)) {
        continue;
      }
      const innerStart = i + attributeMark.prefix.length;
      const close = findClosingDelimiter(text, innerStart, '#');
      if (close > innerStart) {
        const inner = text.slice(innerStart, close);
        flush();
        nodes.push(...parseInline(inner, addMark(marks, attributeMark.type)));
        i = close + 1;
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }

    if (text.startsWith('**', i)) {
      const close = findClosingDelimiter(text, i + 2, '**');
      if (close > i + 2) {
        flush();
        nodes.push(...parseInline(text.slice(i + 2, close), addMark(marks, 'bold')));
        i = close + 2;
        continue;
      }
    }

    if (char === '_') {
      const delimiter = text.startsWith('__', i) ? '__' : '_';
      const innerStart = i + delimiter.length;
      const close = findClosingDelimiter(text, innerStart, delimiter);
      if (close > innerStart) {
        flush();
        nodes.push(
          ...parseInline(text.slice(innerStart, close), addMark(marks, 'italic')),
        );
        i = close + delimiter.length;
      } else {
        buffer += delimiter;
        i += delimiter.length;
      }
      continue;
    }

    if (char === '`') {
      const close = findClosingDelimiter(text, i + 1, '`');
      if (close > i + 1) {
        const inner = unescapeInline(text.slice(i + 1, close));
        flush();
        if (inner.length > 0) {
          nodes.push(makeTextNode(inner, addMark(marks, 'code')));
        }
        i = close + 1;
        continue;
      }
    }

    if (char === '+') {
      const next = text[i + 1];
      if (next !== undefined && !/\s/.test(next)) {
        const close = findClosingDelimiter(text, i + 1, '+');
        if (close > i + 1) {
          const inner = unescapeInline(text.slice(i + 1, close));
          flush();
          if (inner.length > 0) {
            nodes.push(makeTextNode(inner, addMark(marks, 'code')));
          }
          i = close + 1;
          continue;
        }
      }
      buffer += char;
      i++;
      continue;
    }

    if (char === '^' || char === '~') {
      const next = text[i + 1];
      if (next !== undefined && !/\s/.test(next)) {
        const close = findClosingDelimiter(text, i + 1, char);
        if (close > i + 1) {
          const mark = char === '^' ? 'superscript' : 'subscript';
          flush();
          nodes.push(
            ...parseInline(text.slice(i + 1, close), addMark(marks, mark)),
          );
          i = close + 1;
          continue;
        }
      }
      buffer += char;
      i++;
      continue;
    }

    if (text.startsWith('<<', i)) {
      const close = findClosingDelimiter(text, i + 2, '>>');
      if (close > i + 2) {
        const inner = text.slice(i + 2, close);
        const comma = findUnescapedChar(inner, ',');
        const anchor = unescapeInline(
          comma >= 0 ? inner.slice(0, comma) : inner,
        ).trim();
        const label =
          comma >= 0 ? unescapeInline(inner.slice(comma + 1)).trim() : '';

        if (anchor.length > 0) {
          flush();
          nodes.push(
            makeTextNode(
              label.length > 0 ? label : anchor,
              addMark(marks, 'link', { href: `#${anchor}` }),
            ),
          );
          i = close + 2;
          continue;
        }
      }
      buffer += '<';
      i++;
      continue;
    }

    if (text.startsWith('link:', i)) {
      const bracket = text.indexOf('[', i + 5);
      if (bracket !== -1) {
        const close = findClosingDelimiter(text, bracket + 1, ']');
        if (close !== -1) {
          const href = unescapeInline(text.slice(i + 5, bracket)).trim();
          if (href.length > 0) {
            const label = unescapeInline(text.slice(bracket + 1, close));
            flush();
            nodes.push(
              makeTextNode(
                label.length > 0 ? label : href,
                addMark(marks, 'link', { href }),
              ),
            );
            i = close + 1;
            continue;
          }
        }
      }
    }

    const urlMatch =
      /^(?:(?:https?|ftp):\/\/[^\s\[\]]+|mailto:[^\s\[\]]+)/i.exec(
        text.slice(i),
      );
    if (urlMatch) {
      const href = urlMatch[0];
      let end = i + href.length;
      let label = '';

      if (text.charAt(end) === '[') {
        const close = findClosingDelimiter(text, end + 1, ']');
        if (close !== -1) {
          label = unescapeInline(text.slice(end + 1, close));
          if (label.length > 0) {
            end = close + 1;
          }
        }
      }

      flush();
      nodes.push(
        makeTextNode(
          label.length > 0 ? label : href,
          addMark(marks, 'link', { href }),
        ),
      );
      i = end;
      continue;
    }

    buffer += char;
    i++;
  }

  flush();
  return nodes;
}

function makeTextNode(value: string, marks: EditorMark[]): EditorNode {
  return {
    type: 'text',
    text: value,
    ...(marks.length > 0 ? { marks: marks.slice() } : {}),
  };
}

function addMark(
  marks: EditorMark[],
  type: string,
  attrs?: Record<string, unknown>,
): EditorMark[] {
  if (type !== 'link' && marks.some((mark) => mark.type === type)) {
    return marks;
  }

  return [
    ...marks,
    attrs !== undefined ? { type, attrs } : { type },
  ];
}

/** Index of an unescaped delimiter, or -1. */
function findClosingDelimiter(
  text: string,
  from: number,
  delimiter: string,
): number {
  let i = from;
  while (i <= text.length - delimiter.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text.startsWith(delimiter, i)) {
      return i;
    }
    i++;
  }
  return -1;
}

function findUnescapedChar(text: string, char: string): number {
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === char) {
      return i;
    }
    i++;
  }
  return -1;
}

function unescapeInline(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;
    if (char === '\\' && i + 1 < text.length) {
      result += text[i + 1]!;
      i += 2;
      continue;
    }
    result += char;
    i++;
  }

  return result;
}
