// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_SELECTION,
  toggleSelection,
  type FileSelection,
} from '../model/file-selection.js';
import type { LocalFile } from '../model/directory-access.js';
import type { DirectorySession } from '../model/useDirectorySession.js';
import { buildFileTree } from '../model/directory-tree.js';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';

const makeFiles = (paths: string[]): Map<string, LocalFile> =>
  new Map(
    paths.map((path) => [
      path,
      {
        path,
        name: path.split('/').pop() ?? path,
        read: async () => `= ${path}`,
      },
    ]),
  );

const PATHS = ['chapters/intro.adoc', 'chapters/one.adoc', 'appendix.adoc'];

const createSession = (overrides: Partial<DirectorySession> = {}): DirectorySession => {
  const files = makeFiles(PATHS);
  const tree = buildFileTree(PATHS);
  const base: DirectorySession = {
    directory: { name: 'docs', files: [...files.values()], truncated: false },
    files,
    paths: PATHS,
    tree,
    visibleTree: tree,
    query: '',
    setQuery: vi.fn(),
    isSearching: false,
    expanded: new Set(['chapters']),
    isOpen: (path) => path === 'chapters',
    toggleDirectory: vi.fn(),
    picking: false,
    error: null,
    clearError: vi.fn(),
    chooseDirectory: vi.fn(async () => {}),
    readFile: vi.fn(async (path: string) => `= ${path}`),
    pickerAvailable: true,
    truncated: false,
  };
  return { ...base, ...overrides };
};

interface HarnessProps {
  session?: DirectorySession;
  onChoose?: () => void;
}

function Harness({ session = createSession(), onChoose }: HarnessProps) {
  const [selection, setSelection] = useState<FileSelection>(EMPTY_SELECTION);
  const [activePath, setActivePath] = useState<string | null>(null);

  return (
    <WorkspaceSidebar
      directorySession={session}
      selection={selection}
      activePath={activePath}
      draftPaths={new Set(['appendix.adoc'])}
      comparing={false}
      mobileOpen={false}
      onCloseMobile={() => {}}
      onOpenFile={setActivePath}
      onToggleFile={(path) =>
        setSelection((previous) => toggleSelection(previous, path))
      }
      onClearSlot={() => {}}
      onSwap={() => {}}
      onCompare={onChoose ?? (() => {})}
      compareError={null}
      onDismissCompareError={() => {}}
    />
  );
}

const fileNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.ws-file__name'));

const checkboxes = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLInputElement>('.ws-file__checkbox input'),
  );

const compareButton = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('.ws-compare__run');

describe('WorkspaceSidebar', () => {
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

  it('shows the folder, files, search and draft dot', async () => {
    await act(async () => root.render(<Harness />));

    expect(container.textContent).toContain('docs');
    expect(container.textContent).toContain('3 файла');
    expect(container.querySelector('.ws-search input')).not.toBeNull();
    expect(fileNames(container)).toHaveLength(3);
    expect(container.querySelector('.ws-file__draft')).not.toBeNull();
  });

  it('opens a file on name click and toggles a checkbox without opening it', async () => {
    await act(async () => root.render(<Harness />));

    await act(async () => checkboxes(container)[0]?.click());

    expect(compareButton(container)?.disabled).toBe(true);
    expect(container.querySelector('.ws-file__slot--left')?.textContent).toBe(
      'A',
    );

    await act(async () => fileNames(container)[1]?.click());
    expect(fileNames(container)[1]?.getAttribute('aria-current')).toBe('true');
  });

  it('enables "Сравнить" only with two checked files and locks the third', async () => {
    await act(async () => root.render(<Harness />));

    await act(async () => checkboxes(container)[0]?.click());
    await act(async () => checkboxes(container)[1]?.click());

    expect(compareButton(container)?.disabled).toBe(false);
    expect(checkboxes(container)[2]?.disabled).toBe(true);

    // A disabled checkbox must not change the checked pair.
    await act(async () => checkboxes(container)[2]?.click());
    expect(compareButton(container)?.disabled).toBe(false);

    await act(async () => checkboxes(container)[0]?.click());
    expect(compareButton(container)?.disabled).toBe(true);
    expect(checkboxes(container)[2]?.disabled).toBe(false);
  });

  it('renders a storage/read error without breaking the tree', async () => {
    const session = createSession({ error: 'Нет доступа к папке' });
    await act(async () => root.render(<Harness session={session} />));

    expect(container.textContent).toContain('Нет доступа к папке');
    expect(fileNames(container)).toHaveLength(3);
  });

  it('starts with the pick-folder action when no directory is selected', async () => {
    const chooseDirectory = vi.fn(async () => {});
    const session = createSession({
      directory: null,
      files: new Map(),
      paths: [],
      tree: [],
      visibleTree: [],
      expanded: new Set(),
      chooseDirectory,
    });
    await act(async () => root.render(<Harness session={session} />));

    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ws-button'),
    ).find((item) => item.textContent?.includes('Выбрать папку'));

    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(chooseDirectory).toHaveBeenCalledTimes(1);
  });
});
