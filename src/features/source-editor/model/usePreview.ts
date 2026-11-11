import { useEffect, useRef, useState } from 'react';

import type { RenderOptions } from '../../asciidoc-diff/model/render.js';
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
 *
 * Render options are compared by their primitives (directory, asset reader and
 * Kroki endpoint), so callers do not have to memoize the options object.
 */
export function usePreview(
  source: string,
  enabled = true,
  options: RenderOptions = {},
): PreviewState {
  const [state, setState] = useState<PreviewState>({
    ...EMPTY,
    loading: enabled,
  });
  const requestRef = useRef(0);

  const { baseDir, readAsset, krokiUrl } = options;

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

    const renderOptions: RenderOptions = {};
    if (baseDir !== undefined) renderOptions.baseDir = baseDir;
    if (readAsset !== undefined) renderOptions.readAsset = readAsset;
    if (krokiUrl !== undefined) renderOptions.krokiUrl = krokiUrl;

    const timer = window.setTimeout(() => {
      void renderPreview(source, renderOptions)
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
  }, [baseDir, enabled, krokiUrl, readAsset, source]);

  return state;
}
