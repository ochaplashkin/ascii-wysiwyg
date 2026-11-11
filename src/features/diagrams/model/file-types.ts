/**
 * Text file types that the app can open. AsciiDoc documents are comparable,
 * PlantUML diagrams are editable/renderable but not diffed as documents.
 */
export const DIAGRAM_EXTENSIONS = ['.puml', '.plantuml'] as const;

/** True for PlantUML source files (`.puml`, `.plantuml`). */
export function isDiagramFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return false;

  return (DIAGRAM_EXTENSIONS as readonly string[]).includes(
    name.slice(dot).toLowerCase(),
  );
}
