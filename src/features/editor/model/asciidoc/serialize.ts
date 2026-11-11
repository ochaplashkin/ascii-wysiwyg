import type { EditorNode } from '../../editor/types.js';
import {
  codeFence,
  escapeBlockMarkers,
  escapeInlineText,
} from './escape.js';

/**
 * Serialize a Tiptap/ProseMirror JSON document into AsciiDoc.
 *
 * The function is pure (no DOM, no HTML parsing) and is the single source of
 * truth for the "visual document -> AsciiDoc" mapping.
 */
export function serializeAsciiDoc(
  doc: EditorNode | null | undefined,
  title = '',
): string {
  const heading = normalizeTitle(title);
  const body = serializeBlocks(doc?.content);
  const parts = [heading, body].filter((part) => part.length > 0);
  return parts.join('\n\n');
}

type ListKind = 'bullet' | 'ordered' | 'task';

interface SerializeContext {
  table?: boolean;
  /** Zero-based table nesting depth (0 = top-level table). */
  tableDepth?: number;
  /** Active cell separator of the current table (`|` or `!`). */
  tableDelimiter?: string | undefined;
}

const BLOCK_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'table',
  'tableRow',
  'listItem',
  'taskItem',
]);

function normalizeTitle(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? `= ${normalized}` : '';
}

function serializeBlocks(
  nodes: EditorNode[] | undefined,
  context: SerializeContext = {},
): string {
  if (!nodes) {
    return '';
  }

  return nodes
    .map((node) => serializeBlock(node, context))
    .filter((block) => block.trim().length > 0)
    .join('\n\n');
}

function serializeBlock(
  node: EditorNode,
  context: SerializeContext,
): string {
  switch (node.type) {
    case 'doc':
      return serializeBlocks(node.content, context);
    case 'paragraph':
      return serializeParagraph(node, context);
    case 'heading':
      return serializeHeading(node, context);
    case 'bulletList':
      return serializeList(node, 1, 'bullet', context);
    case 'orderedList':
      return serializeList(node, 1, 'ordered', context);
    case 'taskList':
      return serializeList(node, 1, 'task', context);
    case 'blockquote':
      return serializeBlockquote(node, context);
    case 'codeBlock':
      return serializeCodeBlock(node);
    case 'horizontalRule':
      return "'''";
    case 'table':
      return serializeTable(node, context);
    default:
      return serializeUnknown(node, context);
  }
}

function serializeParagraph(
  node: EditorNode,
  context: SerializeContext,
): string {
  const inline = serializeInline(node.content, context);
  if (inline.trim().length === 0) {
    return '';
  }

  return inline
    .split('\n')
    .map((line) => escapeBlockMarkers(line))
    .join('\n');
}

function serializeHeading(
  node: EditorNode,
  context: SerializeContext,
): string {
  const level = clampHeadingLevel(node.attrs?.level);
  const inline = serializeInline(node.content, context)
    .replace(/\n/g, ' ')
    .trim();
  if (inline.length === 0) {
    return '';
  }

  return `${'='.repeat(level + 1)} ${inline}`;
}

function clampHeadingLevel(value: unknown): number {
  const level = typeof value === 'number' ? Math.round(value) : Number(value);
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.min(5, Math.max(1, level));
}

// ---------------------------------------------------------------------------
// Inline content
// ---------------------------------------------------------------------------

function serializeInline(
  nodes: EditorNode[] | undefined,
  context: SerializeContext = {},
): string {
  if (!nodes) {
    return '';
  }

  return nodes.map((node) => serializeInlineNode(node, context)).join('');
}

function serializeInlineNode(
  node: EditorNode,
  context: SerializeContext,
): string {
  if (node.type === 'hardBreak') {
    return ' +\n';
  }

  if (typeof node.text === 'string') {
    const plain = escapeInlineText(node.text, {
      table: context.table === true,
      delimiter: context.tableDelimiter,
    });
    if (plain.length === 0) {
      return '';
    }
    return applyMarks(plain, node);
  }

  if (node.content) {
    const inner = serializeInline(node.content, context);
    return applyMarks(inner, node);
  }

  warnUnknown(`inline node "${node.type ?? 'unknown'}"`);
  return '';
}

/** Marks ordered from innermost to outermost. */
const MARK_ORDER = [
  'subscript',
  'superscript',
  'code',
  'highlight',
  'strike',
  'underline',
  'italic',
  'bold',
  'link',
] as const;

type MarkName = (typeof MARK_ORDER)[number];

function applyMarks(text: string, node: EditorNode): string {
  if (text.length === 0) {
    return '';
  }

  const marks = node.marks ?? [];
  const markByType = new Map(marks.map((mark) => [mark.type, mark] as const));
  const plain = typeof node.text === 'string' ? node.text : undefined;
  let result = text;
  let hasFormatting = false;

  for (const markName of MARK_ORDER) {
    const mark = markByType.get(markName);
    if (!mark) {
      continue;
    }

    if (markName === 'link') {
      result = wrapLink(result, mark, hasFormatting ? undefined : plain);
      continue;
    }

    hasFormatting = true;
    result = wrapMark(markName, result);
  }

  return result;
}

function wrapMark(mark: MarkName, text: string): string {
  switch (mark) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `__${text}__`;
    case 'underline':
      return `[.underline]#${text}#`;
    case 'strike':
      return `[.line-through]#${text}#`;
    case 'highlight':
      return `[.highlight]#${text}#`;
    case 'code':
      return wrapInlineCode(text);
    case 'superscript':
      return `^${text}^`;
    case 'subscript':
      return `~${text}~`;
    default:
      return text;
  }
}

function wrapInlineCode(text: string): string {
  if (text.includes('`')) {
    return `+${text}+`;
  }
  return `\`${text}\``;
}

function wrapLink(
  text: string,
  mark: { attrs?: Record<string, unknown> | undefined },
  plainText: string | undefined,
): string {
  const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href.trim() : '';
  if (href.length === 0) {
    return text;
  }

  const label = text.replace(/\]/g, '\\]');
  const plain = plainText ?? text;

  if (href.startsWith('#')) {
    const anchor = href.slice(1);
    if (anchor.length === 0) {
      return text;
    }
    if (label.length === 0 || plain === anchor) {
      return `<<${anchor}>>`;
    }
    return `<<${anchor},${label}>>`;
  }

  const isBareLink = plain === href && label === plain;
  if (isExternalUrl(href)) {
    if (isBareLink) {
      return href;
    }
    return `${href}[${label.length > 0 ? label : href}]`;
  }

  return `link:${href}[${label.length > 0 ? label : href}]`;
}

function isExternalUrl(href: string): boolean {
  return /^(?:https?|ftp|mailto):/i.test(href);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function serializeList(
  node: EditorNode,
  depth: number,
  kind: ListKind,
  context: SerializeContext = {},
): string {
  const items = node.content ?? [];
  const lines = items.flatMap((item) =>
    serializeListItem(item, depth, kind, context),
  );
  return lines.join('\n');
}

function serializeListItem(
  item: EditorNode,
  depth: number,
  kind: ListKind,
  context: SerializeContext,
): string[] {
  const marker = listMarker(item, depth, kind);
  const children = item.content ?? [];
  const lines: string[] = [];
  let hasContent = false;

  for (const child of children) {
    if (isListKind(child.type, 'bulletList')) {
      const nested = serializeList(child, depth + 1, 'bullet', context);
      if (nested.length > 0) {
        lines.push(...nested.split('\n'));
        hasContent = true;
      }
      continue;
    }

    if (isListKind(child.type, 'orderedList')) {
      const nested = serializeList(child, depth + 1, 'ordered', context);
      if (nested.length > 0) {
        lines.push(...nested.split('\n'));
        hasContent = true;
      }
      continue;
    }

    if (isListKind(child.type, 'taskList')) {
      const nested = serializeList(child, depth + 1, 'task', context);
      if (nested.length > 0) {
        lines.push(...nested.split('\n'));
        hasContent = true;
      }
      continue;
    }

    if (child.type === 'paragraph') {
      const text = serializeInline(child.content, context);
      if (!hasContent) {
        lines.push(text.length > 0 ? `${marker} ${text}` : marker);
        hasContent = true;
      } else if (text.length > 0) {
        lines.push('+', text);
      }
      continue;
    }

    const block = serializeBlock(child, context);
    if (block.length > 0) {
      if (hasContent) {
        lines.push('+');
      }
      lines.push(...block.split('\n'));
      hasContent = true;
    }
  }

  if (lines.length === 0) {
    lines.push(marker);
  }

  return lines;
}

function isListKind(
  type: string | undefined,
  expected: 'bulletList' | 'orderedList' | 'taskList',
): boolean {
  return type === expected;
}

function listMarker(
  item: EditorNode,
  depth: number,
  kind: ListKind,
): string {
  if (kind === 'ordered') {
    return '.'.repeat(depth);
  }

  const bullets = '*'.repeat(depth);
  if (kind === 'task') {
    return `${bullets} ${item.attrs?.checked === true ? '[x]' : '[ ]'}`;
  }

  return bullets;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function serializeBlockquote(
  node: EditorNode,
  context: SerializeContext,
): string {
  const inner = serializeBlocks(node.content, context);
  if (inner.length === 0) {
    return '';
  }

  return `[quote]\n____\n${inner}\n____`;
}

function serializeCodeBlock(node: EditorNode): string {
  const code = (node.content ?? []).map((child) => child.text ?? '').join('');
  const language =
    typeof node.attrs?.language === 'string' ? node.attrs.language.trim() : '';
  const fence = codeFence(code);
  const attribute = language.length > 0 ? `[source,${language}]` : '[source]';
  const body = code.length > 0 ? `${code}${code.endsWith('\n') ? '' : '\n'}` : '';

  return `${attribute}\n${fence}\n${body}${fence}`;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function serializeTable(
  node: EditorNode,
  context: SerializeContext = {},
): string {
  const rows = (node.content ?? []).filter((row) => row.type === 'tableRow');
  if (rows.length === 0) {
    return '';
  }

  const depth = context.tableDepth ?? 0;

  // Asciidoctor supports one level of nested tables reliably: the inner table
  // must use !=== and ! cell separators inside an a| cell. Deeper nesting is
  // flattened to text so the surrounding table stays valid.
  if (depth > 1) {
    warnNestedTableFallback();
    return serializeTableAsText(rows);
  }

  const delimiter = depth === 0 ? '|' : '!';
  const firstRowCells = rows[0]?.content ?? [];
  const hasHeader = firstRowCells.some((cell) => cell.type === 'tableHeader');
  const columnCount = Math.max(1, ...rows.map(countColumns));
  const cols = Array.from({ length: columnCount }, () => '1').join(',');
  const attribute = `[cols="${cols}"${hasHeader ? ',options="header"' : ''}]`;

  const rowBlocks = rows.map((row) =>
    (row.content ?? [])
      .map((cell) => serializeTableCell(cell, delimiter, depth))
      .join('\n'),
  );

  return `${attribute}\n${delimiter}===\n${rowBlocks.join('\n\n')}\n${delimiter}===`;
}

function countColumns(row: EditorNode): number {
  let columns = 0;
  for (const cell of row.content ?? []) {
    columns += positiveInteger(cell.attrs?.colspan);
  }
  return columns;
}

function serializeTableCell(
  cell: EditorNode,
  delimiter: string,
  depth: number,
): string {
  const spec = cellSpec(cell);
  const children = cell.content ?? [];
  const containsTable = children.some((block) => block.type === 'table');

  if (containsTable) {
    // AsciiDoc table cells that contain block content (including a nested
    // table) must be marked with the "a" (AsciiDoc) cell style, e.g. a| or 2+a|.
    const prefix = `${spec}a${delimiter}`;
    const blocks = serializeCellBlocks(cell, depth + 1, delimiter);
    if (blocks.length === 0) {
      return prefix;
    }

    const [first, ...rest] = blocks;
    if (first !== undefined && !first.includes('\n') && first.trim().length > 0) {
      return [`${prefix} ${first}`, ...rest].join('\n\n');
    }

    if (first !== undefined) {
      return [`${prefix}\n${first}`, ...rest].join('\n\n');
    }

    return prefix;
  }

  const content = serializeCellContent(cell, delimiter);
  return content.length > 0
    ? `${spec}${delimiter} ${content}`
    : `${spec}${delimiter}`;
}

/** Block-aware cell content used when a cell contains a nested table. */
function serializeCellBlocks(
  cell: EditorNode,
  nestedTableDepth: number,
  delimiter: string,
): string[] {
  const blocks: string[] = [];

  for (const block of cell.content ?? []) {
    if (block.type === 'paragraph') {
      const text = serializeParagraph(block, {
        table: true,
        tableDelimiter: delimiter,
      }).trimEnd();
      if (text.length > 0) {
        blocks.push(text);
      }
      continue;
    }

    const serialized = serializeBlock(block, {
      table: true,
      tableDepth: nestedTableDepth,
      tableDelimiter: delimiter,
    }).trimEnd();
    if (serialized.length > 0) {
      blocks.push(serialized);
    }
  }

  return blocks;
}

/**
 * Safe fallback for tables nested more than one level deep. Asciidoctor cannot
 * distinguish a second !=== table from the enclosing one, so flatten the rows
 * into plain text rather than corrupting the outer table.
 */
function serializeTableAsText(rows: EditorNode[]): string {
  return rows
    .map((row) =>
      (row.content ?? [])
        .map((cell) =>
          serializeCellText(cell)
            .replace(/\|/g, '\\|')
            .replace(/!/g, '\\!'),
        )
        .join(' | '),
    )
    .join('\n');
}

function serializeCellText(cell: EditorNode): string {
  return (cell.content ?? [])
    .filter((block) => block.type === 'paragraph')
    .map((block) => serializeInline(block.content).trim())
    .filter((text) => text.length > 0)
    .join(' ');
}

function cellSpec(cell: EditorNode): string {
  const colspan = positiveInteger(cell.attrs?.colspan);
  const rowspan = positiveInteger(cell.attrs?.rowspan);

  if (colspan > 1 && rowspan > 1) {
    return `${colspan}.${rowspan}+`;
  }
  if (colspan > 1) {
    return `${colspan}+`;
  }
  if (rowspan > 1) {
    return `.${rowspan}+`;
  }
  return '';
}

function serializeCellContent(
  cell: EditorNode,
  delimiter: string,
): string {
  const parts: string[] = [];

  for (const block of cell.content ?? []) {
    if (block.type === 'paragraph') {
      const text = serializeInline(block.content, {
        table: true,
        tableDelimiter: delimiter,
      }).trimEnd();
      if (text.length > 0) {
        parts.push(text);
      }
      continue;
    }

    const serialized = serializeBlock(block, {
      table: true,
      tableDelimiter: delimiter,
    }).trimEnd();
    if (serialized.length > 0) {
      parts.push(serialized);
    }
  }

  return parts.join(' +\n');
}

function positiveInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

// ---------------------------------------------------------------------------
// Unknown nodes
// ---------------------------------------------------------------------------

function serializeUnknown(
  node: EditorNode,
  context: SerializeContext,
): string {
  warnUnknown(`node "${node.type ?? 'unknown'}"`);

  if (typeof node.text === 'string') {
    return escapeInlineText(node.text, { table: context.table === true });
  }

  const children = node.content ?? [];
  const hasBlockChild = children.some((child) =>
    BLOCK_NODE_TYPES.has(child.type ?? ''),
  );

  if (hasBlockChild) {
    return serializeBlocks(children, context);
  }

  return serializeInline(children, context);
}

const isDevelopment = (() => {
  try {
    return (
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
    );
  } catch {
    return false;
  }
})();

function warnUnknown(description: string): void {
  if (isDevelopment) {
    console.warn(`[asciidoc] Unknown ${description}; serialized its content.`);
  }
}

function warnNestedTableFallback(): void {
  if (isDevelopment) {
    console.warn(
      '[asciidoc] Tables nested deeper than one level are flattened to text.',
    );
  }
}
