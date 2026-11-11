/**
 * Kroki endpoint helpers.
 *
 * The app is a static SPA without a runtime config endpoint, so the base URL
 * comes from the build-time `VITE_KROKI_URL` (default `/kroki`, proxied by
 * nginx). A localStorage override is supported for a future diagram settings
 * dialog and for local experiments.
 */

/** localStorage key for an optional user override of the Kroki endpoint. */
export const KROKI_URL_STORAGE_KEY = 'asciidoc.kroki.url.v1';

/**
 * Normalize a configured Kroki base URL: trim and drop trailing slashes so
 * callers can append `/` or `/health` without creating `//` paths.
 *
 * `/kroki/` -> `/kroki`; `https://kroki.example/` -> `https://kroki.example`;
 * blank values -> `null` (the integration is considered disabled).
 */
export function normalizeKrokiBase(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const normalized = value.replace(/\/+$/, '');
  return normalized || null;
}

/** Services page served by Kroki (`/kroki` -> `/kroki/`). */
export function krokiPageUrl(base: string): string {
  return `${base}/`;
}

/**
 * Liveness endpoint (`/kroki` -> `/kroki/health`). The trailing slash is
 * intentionally not added before `health`.
 */
export function krokiHealthUrl(base: string): string {
  return `${base}/health`;
}

/**
 * Kroki endpoint used by the app: a stored override wins, otherwise the
 * build-time `VITE_KROKI_URL`. Returns `null` when nothing is configured —
 * callers then hide the Kroki affordances.
 */
export function readKrokiUrl(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem(KROKI_URL_STORAGE_KEY);
    // An explicit empty override disables Kroki even if the build-time value
    // is set; this matches the "empty means disabled" contract.
    if (stored !== null && stored !== undefined) {
      return normalizeKrokiBase(stored);
    }
  } catch {
    // Storage may be unavailable (private mode, sandboxed iframe).
  }

  return normalizeKrokiBase(import.meta.env.VITE_KROKI_URL);
}
