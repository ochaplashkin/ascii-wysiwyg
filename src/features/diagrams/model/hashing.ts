/**
 * Small, deterministic string hash (FNV-1a, 32-bit).
 *
 * Used for render-cache keys and for the diff key of a PlantUML block: two
 * diagrams with equal source produce equal hashes, while an edited `.puml`
 * file changes the key even if the rendered SVG looks temporarily identical.
 */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}
