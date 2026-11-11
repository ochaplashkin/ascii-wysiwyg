export interface SourceStats {
  lines: number;
  words: number;
  characters: number;
}

const WORD_RE = /[\p{L}\p{N}_]+/gu;

/** Line, word and character counts for the status bar. */
export function sourceStats(text: string): SourceStats {
  return {
    lines: text.length === 0 ? 0 : text.split('\n').length,
    words: Array.from(text.matchAll(WORD_RE)).length,
    characters: text.length,
  };
}
