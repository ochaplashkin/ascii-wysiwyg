// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  KROKI_HEALTH_TIMEOUT_MS,
  useKrokiHealth,
} from './useKrokiHealth.js';

function Harness({ url }: { url: string | null }) {
  const health = useKrokiHealth(url);

  return (
    <button
      type="button"
      data-status={health.status}
      onClick={health.check}
    >
      {health.status}
    </button>
  );
}

const statusOf = (container: HTMLElement) =>
  container.querySelector('button')?.getAttribute('data-status');

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useKrokiHealth', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (container.firstChild) {
      await act(async () => root.unmount());
    }
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports ok after a successful probe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Harness url="/kroki" />));
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/kroki/health', {
      signal: expect.any(AbortSignal),
      cache: 'no-store',
    });
    expect(statusOf(container)).toBe('ok');
  });

  it('reports error when the endpoint responds with a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await act(async () => root.render(<Harness url="/kroki" />));
    await flush();

    expect(statusOf(container)).toBe('error');
  });

  it('reports error when the request fails (offline/CORS)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await act(async () => root.render(<Harness url="/kroki" />));
    await flush();

    expect(statusOf(container)).toBe('error');
  });

  it('aborts the request and reports error on timeout', async () => {
    vi.useFakeTimers();

    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Harness url="/kroki" />));

    await act(async () => {
      vi.advanceTimersByTime(KROKI_HEALTH_TIMEOUT_MS);
    });
    await flush();

    expect(signal?.aborted).toBe(true);
    expect(statusOf(container)).toBe('error');
  });

  it('aborts the in-flight request on unmount', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise(() => {});
      }),
    );

    await act(async () => root.render(<Harness url="/kroki" />));
    await act(async () => root.unmount());

    expect(signal?.aborted).toBe(true);
  });

  it('does not probe when no URL is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Harness url={null} />));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(statusOf(container)).toBe('unknown');
  });

  it('re-checks when the window regains focus', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Harness url="/kroki" />));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-checks on demand via check()', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Harness url="/kroki" />));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
