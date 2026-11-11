// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPlantUmlCache } from '../model/plantuml.js';
import { PlantUmlPreview } from './PlantUmlPreview.js';

const SOURCE = '@startuml\nAlice -> Bob: test\n@enduml';
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

describe('PlantUmlPreview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    clearPlantUmlCache();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the SVG returned by Kroki', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(SVG, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await act(async () =>
      root.render(<PlantUmlPreview source={SOURCE} url="/kroki" />),
    );
    await act(async () => {
      await wait(400);
    });

    const image = container.querySelector<HTMLImageElement>(
      '.se-puml__image',
    );
    expect(image).not.toBeNull();
    expect(image?.src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(fetchMock).toHaveBeenCalledWith(
      '/kroki/plantuml/svg',
      expect.objectContaining({ method: 'POST', body: SOURCE }),
    );
  });

  it('keeps the editor usable when the diagram fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('plantuml syntax error', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await act(async () =>
      root.render(<PlantUmlPreview source={SOURCE} url="/kroki" />),
    );
    await act(async () => {
      await wait(400);
    });

    expect(container.textContent).toContain(
      'Не удалось отрисовать диаграмму',
    );
    expect(container.textContent).toContain('plantuml syntax error');
  });

  it('explains that Kroki is not configured', async () => {
    await act(async () => {
      root.render(<PlantUmlPreview source={SOURCE} url={null} />);
    });

    expect(container.textContent).toContain('Kroki не настроен');
  });

  it('shows a hint for an empty source', async () => {
    await act(async () => {
      root.render(<PlantUmlPreview source="   " url="/kroki" />);
    });

    expect(container.textContent).toContain('Начните вводить PlantUML');
  });
});
