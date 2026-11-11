import type { ReactNode } from 'react';

/** Icon family for a file, derived from its extension. */
export type FileKind = 'adoc' | 'markdown' | 'text' | 'other';

/** Lower-case extension kind for a file name. */
export function fileKind(name: string): FileKind {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot).toLowerCase() : '';

  if (extension === '.adoc' || extension === '.asciidoc' || extension === '.asc') {
    return 'adoc';
  }
  if (extension === '.md') return 'markdown';
  if (extension === '.txt') return 'text';
  return 'other';
}

const DOCUMENT_PATH =
  'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z';
const FOLD_PATH = 'M14 3v5h5';

const letter = (label: string): ReactNode => (
  <text
    x="12"
    y="17.8"
    textAnchor="middle"
    fontSize="9"
    fontWeight="700"
    fill="currentColor"
    stroke="none"
  >
    {label}
  </text>
);

const CONTENT: Record<FileKind, ReactNode> = {
  adoc: (
    <>
      <path d={DOCUMENT_PATH} />
      <path d={FOLD_PATH} />
      {letter('A')}
    </>
  ),
  markdown: (
    <>
      <path d={DOCUMENT_PATH} />
      <path d={FOLD_PATH} />
      {letter('M')}
    </>
  ),
  text: (
    <>
      <path d={DOCUMENT_PATH} />
      <path d={FOLD_PATH} />
      <path d="M8.5 12.5h7M8.5 15.5h7M8.5 18.5h4" />
    </>
  ),
  other: (
    <>
      <path d={DOCUMENT_PATH} />
      <path d={FOLD_PATH} />
    </>
  ),
};

export interface FileTypeIconProps {
  name: string;
  size?: number;
}

/**
 * Decorative file icon with a fixed slot width, colored by file type.
 * The accessible name comes from the row label, so the icon is hidden from
 * assistive technology.
 */
export function FileTypeIcon({ name, size = 14 }: FileTypeIconProps) {
  const kind = fileKind(name);

  return (
    <span
      className={`ws-file__icon ws-file__icon--${kind}`}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {CONTENT[kind]}
      </svg>
    </span>
  );
}
