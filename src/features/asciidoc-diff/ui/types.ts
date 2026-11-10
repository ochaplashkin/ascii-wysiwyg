export interface SourceDoc {
  name: string;
  text: string;
  /**
   * Path relative to the directory picked in the sidebar. Absent for demo or
   * pasted sources.
   */
  path?: string;
  /**
   * True when the user typed the name manually. Auto-derived names stay in
   * sync with the document text; manual names are preserved.
   */
  nameTouched?: boolean;
}

export interface SourcePair {
  left: SourceDoc;
  right: SourceDoc;
}

export type Side = keyof SourcePair;
