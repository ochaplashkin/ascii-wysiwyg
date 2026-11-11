import { useEffect, useRef, useState } from 'react';

import { renderPreview } from './preview.js';
import type { PreviewResult } from './preview.js';

const PREVIEW_DEBOUNCE = 250;

export interface PreviewState extends PreviewResult {
  loading: boolean;
  error: string | null;
}

const EMPTY: PreviewState = {
  html: '',
  warnings: [],
  loading: false,
  error: null,
};

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

/**
 * Debounced preview rendering with stale-response protection: only the latest
 * request may update the state, even when an older conversion resolves later.
 */
export function usePreview(source: string, enabled = true): PreviewState {
  const [state, setState] = useState<PreviewState>({
    ...EMPTY,
    loading: enabled,
  });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    if (source.trim().length === 0) {
      requestRef.current += 1;
      setState(EMPTY);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    const timer = window.setTimeout(() => {
      void renderPreview(source)
        .then((result) => {
          if (requestRef.current !== requestId) return;
          setState({
            html: result.html,
            warnings: result.warnings,
            loading: false,
            error: null,
          });
        })
        .catch((reason: unknown) => {
          if (requestRef.current !== requestId) return;
          setState({
            ...EMPTY,
            error: errorMessage(reason),
          });
        });
    }, PREVIEW_DEBOUNCE);

    return () => window.clearTimeout(timer);
  }, [enabled, source]);

  return state;
}
