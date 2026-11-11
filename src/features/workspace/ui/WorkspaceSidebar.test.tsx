// @vitest-environment jsdom
import { act, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_SELECTION,
  toggleSelection,
  type FileSelection,
} from '../model/file-selection.js';
import type { LocalFile } from '../model/directory-access.js';
import type { DirectorySession } from '../model/useDirectorySession.js';
import {
  ancestorPaths,
  buildFileTree,
  collectDirectoryPaths,
  filterTree,
  type SortMode,
} from '../model/directory-tree.js';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';

const PATHS = [
  'chapters/intro.adoc',
  'chapters/one.adoc',
  'appendix.adoc',
  'notes.md',
  'aaa.md',
];

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

const toggleInSet = (
  previous: ReadonlySet<string>,
  path: string,
): ReadonlySet<string> => {
  const next = new Set(previous);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
};

/**
 * Small stateful stand-in for `useDirectorySession`: it uses the real tree
 * helpers, so component tests exercise the actual expansion/search semantics
 * without a file picker.
 */
function useLiveSession(
  initialExpanded: string[],
  directories: string[],
  onReveal?: (path: string) => void,
): DirectorySession {
  const files = useMemo(() => makeFiles(PATHS), []);
  const [query, setQueryState] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(initialExpanded),
  );
  const [searchCollapsed, setSearchCollapsed] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [sortMode, setSortModeState] = useState<SortMode>('name');

  const tree = useMemo(
    () => buildFileTree(PATHS, directories, sortMode),
    [directories, sortMode],
  );

  const isSearching = query.trim().length > 0;

  const visibleTree = useMemo(
    () => (isSearching ? filterTree(tree, query) : tree),
    [isSearching, query, tree],
  );

  const searchRef = useRef({ isSearching, query });
  searchRef.current = { isSearching, query };

  const setQuery = useCallback((value: string) => {
    setSearchCollapsed(new Set<string>());
    setQueryState(value);
  }, []);

  const isOpen = useCallback(
    (path: string) =>
      searchRef.current.isSearching
        ? !searchCollapsed.has(path)
        : expanded.has(path),
    [expanded, searchCollapsed],
  );

  const toggleDirectory = useCallback((path: string) => {
    if (searchRef.current.isSearching) {
      setSearchCollapsed((previous) => toggleInSet(previous, path));
      return;
    }
    setExpanded((previous) => toggleInSet(previous, path));
  }, []);

  const expandAll = useCallback(() => {
    if (searchRef.current.isSearching) {
      setSearchCollapsed(new Set<string>());
      return;
    }
    setExpanded(new Set(collectDirectoryPaths(tree)));
  }, [tree]);

  const collapseAll = useCallback(() => {
    if (searchRef.current.isSearching) {
      setSearchCollapsed(new Set(collectDirectoryPaths(visibleTree)));
      return;
    }
    setExpanded(new Set<string>());
  }, [visibleTree]);

  const revealPath = useCallback(
    (path: string) => {
      onReveal?.(path);
      setExpanded((previous) => {
        const next = new Set(previous);
        for (const ancestor of ancestorPaths(path)) next.add(ancestor);
        return next;
      });
      setSearchCollapsed((previous) => {
        const next = new Set(previous);
        for (const ancestor of ancestorPaths(path)) next.delete(ancestor);
        return next;
      });
      const { isSearching: searching, query: current } = searchRef.current;
      if (searching && !path.toLowerCase().includes(current.trim().toLowerCase())) {
        setSearchCollapsed(new Set<string>());
        setQueryState('');
      }
    },
    [onReveal],
  );

  return {
    directory: {
      name: 'docs',
      files: [...files.values()],
      directories,
      truncated: false,
    },
    files,
    paths: PATHS,
    directories,
    tree,
    visibleTree,
    query,
    setQuery,
    isSearching,
    expanded,
    searchCollapsed,
    isOpen,
    toggleDirectory,
    expandAll,
    collapseAll,
    revealPath,
    sortMode,
    setSortMode: setSortModeState,
    picking: false,
    error: null,
    clearError: vi.fn(),
    chooseDirectory: vi.fn(async () => {}),
    readFile: vi.fn(async (path: string) => `= ${path}`),
    pickerAvailable: true,
    truncated: false,
  };
}

const createSession = (
  overrides: Partial<DirectorySession> = {},
): DirectorySession => {
  const files = makeFiles(PATHS);
  const directories = ['chapters'];
  const tree = buildFileTree(PATHS, directories);
  const base: DirectorySession = {
    directory: { name: 'docs', files: [...files.values()], directories, truncated: false },
    files,
    paths: PATHS,
    directories,
    tree,
    visibleTree: tree,
    query: '',
    setQuery: vi.fn(),
    isSearching: false,
    expanded: new Set(['chapters']),
    searchCollapsed: new Set<string>(),
    isOpen: (path) => path === 'chapters',
    toggleDirectory: vi.fn(),
    expandAll: vi.fn(),
    collapseAll: vi.fn(),
    revealPath: vi.fn(),
    sortMode: 'name',
    setSortMode: vi.fn(),
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
  initialExpanded?: string[];
  directories?: string[];
  onReveal?: (path: string) => void;
  onCollapseSidebar?: () => void;
  activePath?: string | null;
  session?: DirectorySession;
}

function Harness({
  initialExpanded = [],
  directories = ['chapters'],
  onReveal,
  onCollapseSidebar,
  activePath: controlledActivePath,
  session: providedSession,
}: HarnessProps) {
  const liveSession = useLiveSession(initialExpanded, directories, onReveal);
  const session = providedSession ?? liveSession;
  const [selection, setSelection] = useState<FileSelection>(EMPTY_SELECTION);
  const [activePath, setActivePath] = useState<string | null>(null);
  const resolvedActivePath =
    controlledActivePath === undefined ? activePath : controlledActivePath;

  return (
    <WorkspaceSidebar
      directorySession={session}
      selection={selection}
      activePath={resolvedActivePath}
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
      onCompare={() => {}}
      compareError={null}
      onDismissCompareError={() => {}}
      {...(onCollapseSidebar ? { onCollapseSidebar } : {})}
    />
  );
}

const fileNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.ws-file__name'));

const fileLabels = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.ws-file__label')).map(
    (element) => element.textContent,
  );

const directoryNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.ws-tree__directory-name')).map(
    (element) => element.textContent,
  );

const folderButtons = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.ws-tree__directory'));

const checkboxes = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLInputElement>('.ws-file__checkbox input'),
  );

const compareButton = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('.ws-compare__run');

const searchInput = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('.ws-search input');

const toolButton = (root: HTMLElement, labelStart: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.ws-tool-button')).find(
    (button) => (button.getAttribute('aria-label') ?? '').startsWith(labelStart),
  );

const treeRows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'));

const rowByPath = (root: HTMLElement, path: string) =>
  root.querySelector<HTMLElement>(`[data-tree-path="${path}"]`);

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const press = async (root: HTMLElement, key: string) => {
  const tree = root.querySelector<HTMLElement>('[role="tree"]');
  if (!tree) throw new Error('tree is not rendered');
  await act(async () => {
    tree.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
};

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
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('starts with only the top level visible', async () => {
    await act(async () => root.render(<Harness />));

    expect(container.textContent).toContain('docs');
    expect(container.textContent).toContain('5 файлов');
    expect(container.querySelector('.ws-search input')).not.toBeNull();
    expect(directoryNames(container)).toEqual(['chapters']);
    expect(fileLabels(container)).toEqual(['aaa.md', 'appendix.adoc', 'notes.md']);
    expect(container.querySelector('.ws-file__draft')).not.toBeNull();
  });

  it('renders file-type icons', async () => {
    await act(async () => root.render(<Harness initialExpanded={['chapters']} />));

    expect(container.querySelectorAll('.ws-file__icon--adoc')).toHaveLength(3);
    expect(container.querySelectorAll('.ws-file__icon--markdown')).toHaveLength(
      2,
    );
  });

  it('opens a file on name click and toggles a checkbox without opening it', async () => {
    await act(async () => root.render(<Harness />));

    await act(async () => checkboxes(container)[0]?.click());

    expect(compareButton(container)?.disabled).toBe(true);
    expect(container.querySelector('.ws-file__slot--left')?.textContent).toBe(
      'A',
    );

    await act(async () => fileNames(container)[1]?.click());
    expect(
      rowByPath(container, 'appendix.adoc')?.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('enables "Сравнить" only with two checked files and locks the third', async () => {
    await act(async () => root.render(<Harness initialExpanded={['chapters']} />));

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

  it('expands and collapses every folder from the toolbar', async () => {
    await act(async () => root.render(<Harness />));

    expect(toolButton(container, 'Развернуть')?.disabled).toBe(false);
    expect(toolButton(container, 'Свернуть')?.disabled).toBe(true);

    await act(async () => toolButton(container, 'Развернуть')?.click());

    expect(fileLabels(container)).toEqual([
      'intro.adoc',
      'one.adoc',
      'aaa.md',
      'appendix.adoc',
      'notes.md',
    ]);
    expect(toolButton(container, 'Развернуть')?.disabled).toBe(true);
    expect(toolButton(container, 'Свернуть')?.disabled).toBe(false);

    await act(async () => toolButton(container, 'Свернуть')?.click());

    expect(directoryNames(container)).toEqual(['chapters']);
    expect(fileLabels(container)).toEqual([
      'aaa.md',
      'appendix.adoc',
      'notes.md',
    ]);
    expect(toolButton(container, 'Развернуть')?.disabled).toBe(false);
    expect(toolButton(container, 'Свернуть')?.disabled).toBe(true);
  });

  it('collapsing everything hides the active file', async () => {
    await act(async () =>
      root.render(<Harness initialExpanded={['chapters']} activePath="chapters/intro.adoc" />),
    );

    expect(rowByPath(container, 'chapters/intro.adoc')).not.toBeNull();

    await act(async () => toolButton(container, 'Свернуть')?.click());

    expect(rowByPath(container, 'chapters/intro.adoc')).toBeNull();
    expect(directoryNames(container)).toEqual(['chapters']);
  });

  it('highlights matches, counts them and restores the previous expansion', async () => {
    await act(async () => root.render(<Harness initialExpanded={['chapters']} />));

    const input = searchInput(container);
    if (!input) throw new Error('search input missing');

    await act(async () => setInputValue(input, 'chapters'));

    expect(container.textContent).toContain('Найдено 2 из 5 файлов');
    expect(container.querySelectorAll('mark.ws-tree__match')).toHaveLength(3);
    // Changing the query re-opens every matching folder.
    expect(fileLabels(container)).toEqual([
      'chapters/intro.adoc',
      'chapters/one.adoc',
    ]);

    // A manual collapse is allowed while searching.
    await act(async () => folderButtons(container)[0]?.click());
    expect(fileLabels(container)).toEqual([]);
    expect(container.textContent).toContain('Найдено 0 из 5 файлов');

    // A new query resets the manual collapse.
    await act(async () => setInputValue(input, 'one'));
    expect(fileLabels(container)).toEqual(['chapters/one.adoc']);

    // Clearing the query returns to the pre-search expansion state.
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.ws-search__clear')?.click();
    });

    expect(input.value).toBe('');
    expect(directoryNames(container)).toEqual(['chapters']);
    expect(fileLabels(container)).toEqual([
      'intro.adoc',
      'one.adoc',
      'aaa.md',
      'appendix.adoc',
      'notes.md',
    ]);
  });

  it('shows the not-found note when the filter matches nothing', async () => {
    await act(async () => root.render(<Harness />));

    const input = searchInput(container);
    if (!input) throw new Error('search input missing');
    await act(async () => setInputValue(input, 'zzz'));

    expect(container.textContent).toContain('Ничего не найдено по запросу «zzz»');
    expect(treeRows(container)).toHaveLength(0);
  });

  it('keeps empty folders in the tree and finds them by path', async () => {
    await act(async () =>
      root.render(<Harness directories={['chapters', 'chapters/empty']} />),
    );

    await act(async () => toolButton(container, 'Развернуть')?.click());

    const emptyRow = rowByPath(container, 'chapters/empty');
    expect(emptyRow).not.toBeNull();
    // "Expand all" also opens folders that have nothing inside.
    expect(emptyRow?.getAttribute('aria-expanded')).toBe('true');
    expect(emptyRow?.querySelector('.ws-tree__directory-name')?.textContent).toBe(
      'empty',
    );

    const input = searchInput(container);
    if (!input) throw new Error('search input missing');
    await act(async () => setInputValue(input, 'empty'));

    expect(rowByPath(container, 'chapters/empty')).not.toBeNull();
    expect(container.textContent).toContain('Найдено 0 из 5 файлов');
  });

  it('toggles row density and exposes aria-pressed', async () => {
    await act(async () => root.render(<Harness />));

    expect(container.querySelector('.ws-tree--compact')).toBeNull();

    const density = toolButton(container, 'Компактная плотность');
    expect(density?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => density?.click());

    expect(container.querySelector('.ws-tree--compact')).not.toBeNull();
    expect(toolButton(container, 'Обычная плотность')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('switches the sort mode', async () => {
    await act(async () => root.render(<Harness initialExpanded={['chapters']} />));

    expect(fileLabels(container)).toEqual([
      'intro.adoc',
      'one.adoc',
      'aaa.md',
      'appendix.adoc',
      'notes.md',
    ]);

    await act(async () => toolButton(container, 'Сортировка: по имени')?.click());

    // By type: `.adoc` before `.md`, so `aaa.md` moves after `appendix.adoc`.
    expect(fileLabels(container)).toEqual([
      'intro.adoc',
      'one.adoc',
      'appendix.adoc',
      'aaa.md',
      'notes.md',
    ]);
    expect(
      toolButton(container, 'Сортировка: по типу')?.getAttribute('aria-label'),
    ).toContain('по типу');
  });

  it('calls the collapse callback from the folder header', async () => {
    const onCollapseSidebar = vi.fn();
    await act(async () =>
      root.render(<Harness onCollapseSidebar={onCollapseSidebar} />),
    );

    await act(async () =>
      container.querySelector<HTMLButtonElement>('.ws-folder__collapse')?.click(),
    );

    expect(onCollapseSidebar).toHaveBeenCalledTimes(1);
  });

  it('uses a single tab stop and supports arrow-key navigation', async () => {
    await act(async () => root.render(<Harness />));

    expect(
      container.querySelectorAll('[role="treeitem"][tabindex="0"]'),
    ).toHaveLength(1);

    const chaptersRow = rowByPath(container, 'chapters');
    if (!chaptersRow) throw new Error('chapters row missing');
    await act(async () => chaptersRow.focus());

    // Right opens a collapsed folder, then moves to its first child.
    await press(container, 'ArrowRight');
    expect(chaptersRow.getAttribute('aria-expanded')).toBe('true');
    await press(container, 'ArrowRight');
    expect(document.activeElement).toBe(rowByPath(container, 'chapters/intro.adoc'));

    // Left on a child moves to the parent, a second Left collapses it.
    await press(container, 'ArrowLeft');
    expect(document.activeElement).toBe(chaptersRow);
    await press(container, 'ArrowLeft');
    expect(chaptersRow.getAttribute('aria-expanded')).toBe('false');

    // Down/Up and Home/End move between visible rows.
    await press(container, 'End');
    expect(document.activeElement).toBe(rowByPath(container, 'notes.md'));
    await press(container, 'Home');
    expect(document.activeElement).toBe(chaptersRow);
    await press(container, 'ArrowDown');
    expect(document.activeElement).toBe(rowByPath(container, 'aaa.md'));

    // Enter opens a file, Space toggles its compare checkbox.
    await press(container, 'Enter');
    expect(rowByPath(container, 'aaa.md')?.getAttribute('aria-selected')).toBe(
      'true',
    );

    await press(container, ' ');
    expect(
      rowByPath(container, 'aaa.md')?.querySelector<HTMLInputElement>('input')
        ?.checked,
    ).toBe(true);
  });

  it('reveals the ancestors of the active file and scrolls to it', async () => {
    const onReveal = vi.fn();
    await act(async () =>
      root.render(
        <Harness activePath="chapters/intro.adoc" onReveal={onReveal} />,
      ),
    );

    expect(onReveal).toHaveBeenCalledWith('chapters/intro.adoc');
    expect(rowByPath(container, 'chapters/intro.adoc')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('renders a storage/read error without breaking the tree', async () => {
    const session = createSession({ error: 'Нет доступа к папке' });
    await act(async () => root.render(<Harness session={session} />));

    expect(container.textContent).toContain('Нет доступа к папке');
    expect(fileLabels(container)).toHaveLength(5);
  });

  it('starts with the pick-folder action when no directory is selected', async () => {
    const chooseDirectory = vi.fn(async () => {});
    const session = createSession({
      directory: null,
      files: new Map(),
      paths: [],
      directories: [],
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
