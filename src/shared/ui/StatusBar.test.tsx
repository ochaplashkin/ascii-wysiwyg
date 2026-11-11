// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StatusBar } from './StatusBar.js';

describe('StatusBar', () => {
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
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the statistics, save status and badge', async () => {
    await act(async () =>
      root.render(
        <StatusBar lines={3} words={2} characters={10} saveStatus="saved" />,
      ),
    );

    expect(container.textContent).toContain('Строк:');
    expect(container.textContent).toContain('Слов:');
    expect(container.textContent).toContain('Символов:');
    expect(container.textContent).toContain('Сохранено');
    expect(container.textContent).toContain('AsciiDoc');
  });

  it('renders service actions in the dedicated slot', async () => {
    await act(async () =>
      root.render(
        <StatusBar
          words={2}
          characters={10}
          saveStatus="saved"
          actions={<a href="/kroki/">Kroki</a>}
        />,
      ),
    );

    const slot = container.querySelector('.se-statusbar__actions');
    expect(slot).not.toBeNull();
    expect(slot?.querySelector('a')?.getAttribute('href')).toBe('/kroki/');
  });

  it('omits the actions slot when no actions are passed', async () => {
    await act(async () =>
      root.render(
        <StatusBar words={2} characters={10} saveStatus="saved" />,
      ),
    );

    expect(container.querySelector('.se-statusbar__actions')).toBeNull();
  });
});
