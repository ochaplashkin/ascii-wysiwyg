// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarRail } from './SidebarRail.js';

describe('SidebarRail', () => {
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

  it('exposes the expand button with the panel relationship', async () => {
    const onExpand = vi.fn();
    await act(async () =>
      root.render(<SidebarRail onExpand={onExpand} />),
    );

    const button = container.querySelector<HTMLButtonElement>('.ws-rail__button');
    expect(button?.getAttribute('aria-label')).toBe('Показать панель файлов');
    expect(button?.getAttribute('aria-controls')).toBe('workspace-sidebar');
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => button?.click());
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('focuses the expand button through the provided ref', async () => {
    const buttonRef = createRef<HTMLButtonElement>();
    await act(async () =>
      root.render(<SidebarRail onExpand={() => {}} buttonRef={buttonRef} />),
    );

    expect(buttonRef.current).toBe(
      container.querySelector('.ws-rail__button'),
    );
  });
});
