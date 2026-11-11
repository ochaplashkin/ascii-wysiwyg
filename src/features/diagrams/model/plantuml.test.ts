// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PLANTUML_TIMEOUT_MS,
  clearPlantUmlCache,
  renderPlantUml,
} from './plantuml.js';

const SOURCE = '@startuml\nAlice -> Bob: test\n@enduml';
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const svgResponse = () =>
  new Response(SVG, {
    status: 200,
    headers: { 'Content-Type': 'image/svg+xml' },
  });

beforeEach(() => clearPlantUmlCache());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('renderPlantUml', () => {
  it('posts the source to Kroki and returns an SVG data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svgResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderPlantUml(SOURCE, { url: '/kroki/' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/kroki/plantuml/svg',
      expect.objectContaining({
        method: 'POST',
        body: SOURCE,
        credentials: 'omit',
        headers: expect.objectContaining({
          'Content-Type': 'text/plain; charset=utf-8',
          Accept: 'image/svg+xml',
        }),
      }),
    );
    expect(result.format).toBe('svg');
    expect(result.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);

    const encoded = result.dataUrl.slice(result.dataUrl.indexOf(',') + 1);
    expect(atob(encoded)).toContain('<svg');
  });

  it('caches by endpoint, format and source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svgResponse());
    vi.stubGlobal('fetch', fetchMock);

    const first = await renderPlantUml(SOURCE, { url: '/kroki' });
    const second = await renderPlantUml(SOURCE, { url: '/kroki/' });

    expect(first.dataUrl).toBe(second.dataUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports PNG output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await renderPlantUml(SOURCE, {
      url: '/kroki',
      format: 'png',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/kroki/plantuml/png');
    expect(result.format).toBe('png');
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('surfaces the HTTP error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Syntax Error?', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(
      renderPlantUml(SOURCE, { url: '/kroki' }),
    ).rejects.toThrow(/Kroki вернул 400.*Syntax Error/);
  });

  it('rejects an unexpected content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not an image', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(
      renderPlantUml(SOURCE, { url: '/kroki' }),
    ).rejects.toThrow(/неожиданный тип/);
  });

  it('times out an unresponsive Kroki', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const promise = renderPlantUml(SOURCE, { url: '/kroki' });
    const assertion = expect(promise).rejects.toThrow(/не ответил/);

    await vi.advanceTimersByTimeAsync(PLANTUML_TIMEOUT_MS + 10);
    await assertion;
  });

  it('reports a missing endpoint', async () => {
    await expect(renderPlantUml(SOURCE, { url: '' })).rejects.toThrow(
      /Kroki не настроен/,
    );
  });
});
