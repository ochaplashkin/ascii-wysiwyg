/** A file opened from the user's local directory. */
export interface SourceDoc {
  /** File name with extension, e.g. `chapter-1.adoc`. */
  name: string;
  /** Path relative to the picked directory, using `/` separators. */
  path: string;
  text: string;
}

export interface SourcePair {
  left: SourceDoc;
  right: SourceDoc;
}

export type Side = keyof SourcePair;

export type SaveStatus = 'saved' | 'saving' | 'error';

export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Сохранено локально',
  saving: 'Сохранение…',
  error: 'Не удалось сохранить черновик',
};
