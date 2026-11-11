/** PlantUML output formats supported by Kroki. */
export type PlantUmlFormat = 'svg' | 'png';

/** A `plantuml::file.puml[]` macro discovered during one conversion. */
export interface PlantUmlRequest {
  /** Unique DOM id of the pass-block placeholder inside this conversion. */
  id: string;
  /** Target exactly as written in the macro (relative to the document). */
  target: string;
  format: PlantUmlFormat;
  title: string | null;
  alt: string | null;
  line: number | null;
}

/** Result of reading and rendering one macro request. */
export interface PlantUmlOutcome {
  request: PlantUmlRequest;
  /** Base64 data URL of the rendered image, or `null` on failure. */
  dataUrl: string | null;
  /** Hash of the resolved `.puml` content; part of the diff block key. */
  sourceHash: string | null;
  error: string | null;
}

/** Everything the renderer needs to resolve a macro target. */
export interface DiagramRenderContext {
  /** Directory of the .adoc document (relative to the picked folder). */
  baseDir: string;
  /** Reads a file from the picked folder by normalized relative path. */
  readAsset: ((path: string) => Promise<string>) | null;
  /** Kroki base URL; `null` disables rendering with a clear fallback. */
  krokiUrl: string | null;
}
