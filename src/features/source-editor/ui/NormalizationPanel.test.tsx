// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NormalizationPanel } from './NormalizationPanel.js';

const findButton = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes(text),
  );

describe('NormalizationPanel', () => {
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
    vi.restoreAllMocks();
  });

  it('shows the baseline -> source diff and exposes all three actions', async () => {
    const onKeep = vi.fn();
    const onBackToVisual = vi.fn();
    const onDiscard = vi.fn();

    await act(async () => {
      root.render(
        <NormalizationPanel
          baseline={'= Документ\n\n_курсив_'}
          source={'= Документ\n\n__курсив__'}
          onKeep={onKeep}
          onBackToVisual={onBackToVisual}
          onDiscard={onDiscard}
        />,
      );
    });

    expect(container.textContent).toContain('Разметка нормализована');
    expect(container.textContent).toContain('_курсив_');
    expect(container.textContent).toContain('__курсив__');
    expect(container.querySelectorAll('.se-diffrow.is-removed')).toHaveLength(1);
    expect(container.querySelectorAll('.se-diffrow.is-added')).toHaveLength(1);

    await act(async () => findButton(container, 'Оставить')?.click());
    expect(onKeep).toHaveBeenCalledTimes(1);

    await act(async () =>
      findButton(container, 'Вернуться в визуальный режим')?.click(),
    );
    expect(onBackToVisual).toHaveBeenCalledTimes(1);

    await act(async () =>
      findButton(container, 'Отменить визуальные правки')?.click(),
    );
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
