type TokenKind = 'tag' | 'space' | 'word' | 'punct' | 'entity';

interface Token {
  kind: TokenKind;
  value: string;
}

export interface InlineDiffResult {
  leftHtml: string;
  rightHtml: string;
}

interface MatchResult {
  leftMatched: boolean[];
  rightMatched: boolean[];
}

const TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const ENTITY_RE = /&(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);/g;
const MAX_DP_CELLS = 1_500_000;

let segmenter: Intl.Segmenter | null | undefined;

const getSegmenter = (): Intl.Segmenter | null => {
  if (segmenter !== undefined) return segmenter;

  try {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  } catch {
    segmenter = null;
  }

  return segmenter;
};

const classify = (value: string): TokenKind => {
  if (/^\s+$/.test(value)) return 'space';
  if (/[\p{L}\p{N}_]/u.test(value)) return 'word';
  return 'punct';
};

const tokenizePlainText = (value: string): Token[] => {
  const tokens: Token[] = [];
  const activeSegmenter = getSegmenter();

  if (activeSegmenter) {
    for (const part of activeSegmenter.segment(value)) {
      if (!part.segment) continue;
      tokens.push({ kind: classify(part.segment), value: part.segment });
    }
    return tokens;
  }

  for (const part of value.match(/\s+|[^\s]+/g) ?? []) {
    tokens.push({ kind: classify(part), value: part });
  }

  return tokens;
};

/**
 * Entities (`&amp;`, `&#8212;`) must stay atomic: wrapping a fragment of an
 * entity in `<del>` would corrupt the HTML.
 */
const tokenizeText = (value: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(ENTITY_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizePlainText(value.slice(lastIndex, index)));
    }
    tokens.push({ kind: 'entity', value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    tokens.push(...tokenizePlainText(value.slice(lastIndex)));
  }

  return tokens;
};

const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(TAG_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizeText(html.slice(lastIndex, index)));
    }
    tokens.push({ kind: 'tag', value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < html.length) {
    tokens.push(...tokenizeText(html.slice(lastIndex)));
  }

  return tokens;
};

/**
 * Marks tokens that belong to the longest common subsequence. Common prefix
 * and suffix are trimmed first, which keeps the DP small for typical edits.
 */
function matchTokens(left: Token[], right: Token[]): MatchResult | null {
  const leftMatched = new Array<boolean>(left.length).fill(false);
  const rightMatched = new Array<boolean>(right.length).fill(false);

  let start = 0;
  while (
    start < left.length &&
    start < right.length &&
    (left[start] as Token).value === (right[start] as Token).value
  ) {
    leftMatched[start] = true;
    rightMatched[start] = true;
    start += 1;
  }

  let leftEnd = left.length - 1;
  let rightEnd = right.length - 1;

  while (
    leftEnd >= start &&
    rightEnd >= start &&
    (left[leftEnd] as Token).value === (right[rightEnd] as Token).value
  ) {
    leftMatched[leftEnd] = true;
    rightMatched[rightEnd] = true;
    leftEnd -= 1;
    rightEnd -= 1;
  }

  const rows = leftEnd - start + 1;
  const cols = rightEnd - start + 1;

  if (rows <= 0 || cols <= 0) {
    return { leftMatched, rightMatched };
  }

  if (rows * cols > MAX_DP_CELLS) {
    return null;
  }

  const table: Uint32Array[] = Array.from(
    { length: rows + 1 },
    () => new Uint32Array(cols + 1),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    const row = table[i] as Uint32Array;
    const nextRow = table[i + 1] as Uint32Array;
    const leftToken = left[start + i] as Token;

    for (let j = cols - 1; j >= 0; j -= 1) {
      row[j] =
        leftToken.value === (right[start + j] as Token).value
          ? (nextRow[j + 1] as number) + 1
          : Math.max(nextRow[j] as number, row[j + 1] as number);
    }
  }

  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if ((left[start + i] as Token).value === (right[start + j] as Token).value) {
      leftMatched[start + i] = true;
      rightMatched[start + j] = true;
      i += 1;
      j += 1;
      continue;
    }

    if (
      ((table[i + 1] as Uint32Array)[j] as number) >=
      ((table[i] as Uint32Array)[j + 1] as number)
    ) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return { leftMatched, rightMatched };
}

const renderSide = (
  tokens: Token[],
  matched: boolean[],
  tagName: 'del' | 'ins',
): string => {
  let html = '';
  let run = '';
  let runChanged = false;

  const flush = () => {
    if (!run) return;
    html += runChanged
      ? `<${tagName} class="adoc-word adoc-word--${tagName}">${run}</${tagName}>`
      : run;
    run = '';
    runChanged = false;
  };

  tokens.forEach((token, index) => {
    if (token.kind === 'tag') {
      flush();
      html += token.value;
      return;
    }

    const changed = !matched[index] && token.kind !== 'space';

    if (run && changed !== runChanged) flush();

    runChanged = changed;
    run += token.value;
  });

  flush();
  return html;
};

const hasChangedText = (tokens: Token[], matched: boolean[]): boolean =>
  tokens.some(
    (token, index) =>
      !matched[index] && token.kind !== 'tag' && token.kind !== 'space',
  );

/**
 * Token-level HTML diff for a pair of changed blocks. Tags are kept intact on
 * both sides; only changed text is wrapped in `<del>`/`<ins>`. Returns `null`
 * when the blocks are identical, only markup changed, or the block is too big
 * for the DP matrix (the UI then falls back to whole-block highlighting).
 */
export function inlineDiff(
  leftHtml: string,
  rightHtml: string,
): InlineDiffResult | null {
  if (leftHtml === rightHtml) return null;

  const leftTokens = tokenize(leftHtml);
  const rightTokens = tokenize(rightHtml);
  const match = matchTokens(leftTokens, rightTokens);

  if (!match) return null;

  const leftChanged = hasChangedText(leftTokens, match.leftMatched);
  const rightChanged = hasChangedText(rightTokens, match.rightMatched);

  if (!leftChanged && !rightChanged) return null;

  return {
    leftHtml: renderSide(leftTokens, match.leftMatched, 'del'),
    rightHtml: renderSide(rightTokens, match.rightMatched, 'ins'),
  };
}
