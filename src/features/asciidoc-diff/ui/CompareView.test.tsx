// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SourceDoc } from '../../../shared/model/types.js';
import CompareView from './CompareView.js';

const left: SourceDoc = {
  name: 'a.adoc',
  path: 'chapters/a.adoc',
  text: '= Документ\n\nПервая строка.',
};

const right: SourceDoc = {
  name: 'b.adoc',
  path: 'chapters/b.adoc',
  text: '= Документ\n\nПервая строка изменена.',
};

const findButton = (root: HTMLElement, label: string) =>
  root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

describe('CompareView', () => {
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

  it('renders the diff, opens sources and closes the comparison', async () => {
    const onClose = vi.fn();
    const onOpenFile = vi.fn();
    const onSwap = vi.fn();

    await act(async () => {
      root.render(
        <CompareView
          left={left}
          right={right}
          onSwap={onSwap}
          onClose={onClose}
          onOpenFile={onOpenFile}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Первая строка изменена.');
    });

    expect(container.textContent).toContain('изменено');
    expect(container.querySelectorAll('.adoc-diff__cell').length).toBeGreaterThan(0);

    await act(async () => {
      findButton(container, 'Закрыть сравнение')?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const sourceButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.adoc-diff__source-button'),
    ).find((button) => button.textContent?.includes('a.adoc'));
    await act(async () => sourceButton?.click());
    expect(onOpenFile).toHaveBeenCalledWith('chapters/a.adoc');

    await act(async () => {
      findButton(container, 'Поменять документы местами')?.click();
    });
    expect(onSwap).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state for identical documents', async () => {
    await act(async () => {
      root.render(
        <CompareView
          left={left}
          right={{ ...left, name: 'copy.adoc', path: 'copy.adoc' }}
          onSwap={() => {}}
          onClose={() => {}}
          onOpenFile={() => {}}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Документы идентичны');
    });
  });
});
