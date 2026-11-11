import { useCallback, useEffect, useState } from 'react';

import { krokiHealthUrl } from './kroki-url.js';

/** Health check states exposed to the UI. */
export type KrokiHealthStatus = 'unknown' | 'checking' | 'ok' | 'error';

/** Do not let a cold JVM render blocking the status bar for too long. */
export const KROKI_HEALTH_TIMEOUT_MS = 4000;

export interface KrokiHealth {
  status: KrokiHealthStatus;
  /** Re-run the check (e.g. from a "retry" affordance). */
  check: () => void;
}

/**
 * Non-blocking liveness probe for the configured Kroki instance.
 *
 * A failed probe (offline service, CORS, timeout) only changes the status; the
 * editor and the link stay usable. Checks run on mount, when the URL changes,
 * on a manual `check()`, and — optionally — when the window regains focus.
 */
export function useKrokiHealth(
  url: string | null,
  refreshOnFocus = true,
): KrokiHealth {
  const [status, setStatus] = useState<KrokiHealthStatus>(
    url ? 'checking' : 'unknown',
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) {
      setStatus('unknown');
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setStatus('checking');

    const timer = setTimeout(() => {
      // A timeout is reported through the same abort path as unmount; the
      // `cancelled` flag is what keeps the state update out of a dead tree.
      controller.abort();
    }, KROKI_HEALTH_TIMEOUT_MS);

    void (async () => {
      try {
        const response = await fetch(krokiHealthUrl(url), {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!cancelled) setStatus(response.ok ? 'ok' : 'error');
      } catch {
        // Network error, CORS failure or abort (timeout/unmount).
        if (!cancelled) setStatus('error');
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, attempt]);

  useEffect(() => {
    if (!url || !refreshOnFocus || typeof window === 'undefined') return;

    const handler = () => setAttempt((value) => value + 1);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [url, refreshOnFocus]);

  const check = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { status, check };
}
