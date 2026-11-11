import { useEffect, useRef, useState } from 'react';

import { renderPlantUml } from './plantuml.js';
import type { PlantUmlFormat } from './types.js';

const PREVIEW_DEBOUNCE = 300;

export type PlantUmlPreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlantUmlPreviewState {
  status: PlantUmlPreviewStatus;
  dataUrl: string | null;
  error: string | null;
}

const IDLE: PlantUmlPreviewState = {
  status: 'idle',
  dataUrl: null,
  error: null,
};

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

/**
 * Debounced live render of a PlantUML source through Kroki.
 *
 * The previous image stays visible while the next request is in flight; stale
 * responses are ignored and unmount aborts the request.
 */
export function usePlantUmlPreview(
  source: string,
  url: string | null,
  format: PlantUmlFormat = 'svg',
  enabled = true,
): PlantUmlPreviewState {
  const [state, setState] = useState<PlantUmlPreviewState>(IDLE);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (source.trim().length === 0) {
      setState(IDLE);
      return;
    }

    if (!url) {
      setState({
        status: 'error',
        dataUrl: null,
        error: 'Kroki не настроен: задайте VITE_KROKI_URL.',
      });
      return;
    }

    setState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }));

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void renderPlantUml(source, { url, format, signal: controller.signal })
        .then((result) => {
          if (requestRef.current !== requestId) return;
          setState({
            status: 'ready',
            dataUrl: result.dataUrl,
            error: null,
          });
        })
        .catch((reason: unknown) => {
          if (requestRef.current !== requestId || controller.signal.aborted) {
            return;
          }
          setState({
            status: 'error',
            dataUrl: null,
            error: errorMessage(reason),
          });
        });
    }, PREVIEW_DEBOUNCE);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, format, source, url]);

  return state;
}
