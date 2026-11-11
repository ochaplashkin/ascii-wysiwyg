import { Fragment, type ReactNode } from 'react';

export interface HighlightedTextProps {
  text: string;
  query: string;
}

/**
 * Highlights every case-insensitive occurrence of the query without building
 * a regular expression, so characters like `.` or `*` are matched literally.
 */
export function HighlightedText({ text, query }: HighlightedTextProps) {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return <Fragment>{text}</Fragment>;

  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark className="ws-tree__match" key={`${index}-${needle}`}>
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  return <Fragment>{parts}</Fragment>;
}
