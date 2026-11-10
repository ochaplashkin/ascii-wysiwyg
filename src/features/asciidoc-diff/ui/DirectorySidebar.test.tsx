// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectorySidebar } from './DirectorySidebar.js';
import type { SourcePair } from './types.js';

interface FakeFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
}

interface FakeDirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncIterable<FakeFileHandle | FakeDirectoryHandle>;
}

const fakeFile = (name: string, text: string): FakeFileHandle => ({
  kind: 'file',
  name,
  getFile: async () => ({ text: async () => text }) as unknown as File,
});

const fakeDirectory = (
  name: string,
  entries: Array<FakeFileHandle | FakeDirectoryHandle>,
): FakeDirectoryHandle => ({
  kind: 'directory',
  name,
  values: async function* values() {
    yield* entries;
  },
});

const installPicker = (
  picker: (options?: { mode?: 'read' }) => Promise<FakeDirectoryHandle>,
) => {
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    writable: true,
    value: picker,
  });
};

const sources: SourcePair = {
  left: { name: 'Демо: оригинал', text: '= Demo' },
  right: { name: 'Демо: изменённый', text: '= Demo' },
};

const findButton = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(text),
  );

describe('DirectorySidebar', () => {
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
    delete (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker;
    vi.restoreAllMocks();
  });

  it('shows the picked folder and compares two selected files automatically', async () => {
    installPicker(async () =>
      fakeDirectory('docs', [
        fakeFile('b.adoc', '= Beta'),
        fakeFile('a.adoc', '= Alpha'),
      ]),
    );
    const onApply = vi.fn();

    await act(async () => {
      root.render(<DirectorySidebar sources={sources} onApply={onApply} />);
    });

    const pick = findButton(container, 'Выбрать папку');
    expect(pick).toBeDefined();

    await act(async () => {
      pick?.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('a.adoc');
      expect(container.textContent).toContain('b.adoc');
      expect(container.textContent).toContain('2 файла');
    });

    const fileButtons = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('.adoc-diff__file-row'),
      );

    expect(fileButtons().map((button) => button.textContent)).toEqual([
      'a.adoc',
      'b.adoc',
    ]);

    await act(async () => {
      fileButtons()[0]?.click();
    });
    expect(onApply).not.toHaveBeenCalled();

    await act(async () => {
      fileButtons()[1]?.click();
    });

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));

    expect(onApply).toHaveBeenCalledWith({
      left: { name: 'a.adoc', text: '= Alpha', path: 'a.adoc' },
      right: { name: 'b.adoc', text: '= Beta', path: 'b.adoc' },
    });
  });
});
