// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '../model/sidebar-layout.js';
import { SidebarResizer } from './SidebarResizer.js';

describe('SidebarResizer', () => {
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

  const render = async (
    width: number,
    onChange = vi.fn(),
    onCommit = vi.fn(),
  ) => {
    await act(async () =>
      root.render(
        <SidebarResizer
          width={width}
          onChange={onChange}
          onCommit={onCommit}
        />,
      ),
    );
    const handle = container.querySelector<HTMLElement>(
      '.ws-sidebar__resizer',
    );
    if (!handle) throw new Error('resizer is not rendered');
    return { handle, onChange, onCommit };
  };

  const press = async (element: HTMLElement, key: string) => {
    await act(async () => {
      element.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
    });
  };

  it('exposes the separator ARIA contract', async () => {
    const { handle } = await render(SIDEBAR_DEFAULT_WIDTH);

    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Ширина панели файлов');
    expect(handle.getAttribute('aria-valuenow')).toBe(String(SIDEBAR_DEFAULT_WIDTH));
    expect(handle.getAttribute('aria-valuemin')).toBe(String(SIDEBAR_MIN_WIDTH));
    expect(handle.getAttribute('aria-valuemax')).toBe(String(SIDEBAR_MAX_WIDTH));
    expect(handle.tabIndex).toBe(0);
  });

  it('resizes with the arrow keys and commits each step', async () => {
    const { handle, onChange, onCommit } = await render(SIDEBAR_DEFAULT_WIDTH);

    await press(handle, 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH + 16);
    expect(onCommit).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH + 16);

    await press(handle, 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith(SIDEBAR_DEFAULT_WIDTH - 16);
  });

  it('clamps keyboard resizing to the allowed range', async () => {
    const max = await render(SIDEBAR_MAX_WIDTH);
    await press(max.handle, 'ArrowRight');
    expect(max.onCommit).toHaveBeenLastCalledWith(SIDEBAR_MAX_WIDTH);

    const min = await render(SIDEBAR_MIN_WIDTH);
    await press(min.handle, 'ArrowLeft');
    expect(min.onCommit).toHaveBeenLastCalledWith(SIDEBAR_MIN_WIDTH);
  });

  it('jumps to the minimum and maximum with Home and End', async () => {
    const { handle, onCommit } = await render(SIDEBAR_DEFAULT_WIDTH);

    await press(handle, 'Home');
    expect(onCommit).toHaveBeenLastCalledWith(SIDEBAR_MIN_WIDTH);

    await press(handle, 'End');
    expect(onCommit).toHaveBeenLastCalledWith(SIDEBAR_MAX_WIDTH);
  });

  it('ignores modified and unrelated keys', async () => {
    const { handle, onChange } = await render(SIDEBAR_DEFAULT_WIDTH);

    await act(async () => {
      handle.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          ctrlKey: true,
          bubbles: true,
        }),
      );
    });
    await press(handle, 'Enter');
    await press(handle, 'a');

    expect(onChange).not.toHaveBeenCalled();
  });
});
