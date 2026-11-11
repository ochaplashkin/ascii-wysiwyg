import { useCallback, useMemo, useRef, useState } from 'react';

import {
  canPickDirectory,
  pickLocalDirectory,
  type LocalDirectory,
  type LocalFile,
} from './directory-access.js';
import {
  ancestorPaths,
  buildFileTree,
  collectDirectoryPaths,
  filterTree,
  type SortMode,
  type TreeNode,
} from './directory-tree.js';

export interface DirectorySession {
  directory: LocalDirectory | null;
  files: ReadonlyMap<string, LocalFile>;
  paths: string[];
  directories: readonly string[];
  tree: TreeNode[];
  visibleTree: TreeNode[];
  query: string;
  setQuery: (value: string) => void;
  isSearching: boolean;
  /** Directories expanded outside of search. */
  expanded: ReadonlySet<string>;
  /** Directories manually collapsed while the search filter is active. */
  searchCollapsed: ReadonlySet<string>;
  isOpen: (path: string) => boolean;
  toggleDirectory: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** Expands the ancestors of `path` and drops a filter hiding it. */
  revealPath: (path: string) => void;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  picking: boolean;
  error: string | null;
  clearError: () => void;
  chooseDirectory: () => Promise<void>;
  /**
   * Reads a file once and caches the text until the folder changes. Pass
   * `fresh` to bypass the cache ("Перечитать с диска").
   */
  readFile: (path: string, fresh?: boolean) => Promise<string>;
  pickerAvailable: boolean;
  truncated: boolean;
}

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * Owns the picked directory: the native picker, the file tree, search and the
 * text cache. Every file read is local; nothing is sent to a server.
 */
export function useDirectorySession(): DirectorySession {
  const [directory, setDirectory] = useState<LocalDirectory | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQueryState] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [searchCollapsed, setSearchCollapsed] =
    useState<ReadonlySet<string>>(EMPTY_SET);
  const [sortMode, setSortMode] = useState<SortMode>('name');

  const pickingRef = useRef(false);
  const cacheRef = useRef(new Map<string, string>());

  const pickerAvailable = useMemo(() => canPickDirectory(), []);

  const paths = useMemo(
    () => directory?.files.map((file) => file.path) ?? [],
    [directory],
  );

  const directories = useMemo(
    () => directory?.directories ?? [],
    [directory],
  );

  const files = useMemo(() => {
    const map = new Map<string, LocalFile>();
    for (const file of directory?.files ?? []) map.set(file.path, file);
    return map;
  }, [directory]);

  const tree = useMemo(
    () => buildFileTree(paths, directories, sortMode),
    [directories, paths, sortMode],
  );

  const isSearching = query.trim().length > 0;

  const visibleTree = useMemo(
    () => (isSearching ? filterTree(tree, query) : tree),
    [isSearching, query, tree],
  );

  // Search callbacks read the latest filter without changing identity, so the
  // "reveal active file" effect does not re-run on every keystroke.
  const searchStateRef = useRef({ isSearching, query });
  searchStateRef.current = { isSearching, query };

  const clearSearchCollapsed = useCallback(() => {
    setSearchCollapsed((previous) =>
      previous.size === 0 ? previous : new Set<string>(),
    );
  }, []);

  /** Changing the query gives every match a fresh expanded state. */
  const setQuery = useCallback(
    (value: string) => {
      clearSearchCollapsed();
      setQueryState(value);
    },
    [clearSearchCollapsed],
  );

  const chooseDirectory = useCallback(async () => {
    // A ref guard stops a double click from opening two native dialogs before
    // React re-renders the disabled button.
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    setError(null);

    try {
      const next = await pickLocalDirectory();
      if (!next) return;

      cacheRef.current.clear();
      setDirectory(next);
      // Only the top level is visible after picking a folder.
      setQueryState('');
      setExpanded(EMPTY_SET);
      setSearchCollapsed(EMPTY_SET);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }, []);

  const toggleDirectory = useCallback(
    (path: string) => {
      if (searchStateRef.current.isSearching) {
        setSearchCollapsed((previous) => {
          const next = new Set(previous);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        return;
      }

      setExpanded((previous) => {
        const next = new Set(previous);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [],
  );

  const isOpen = useCallback(
    (path: string) =>
      isSearching ? !searchCollapsed.has(path) : expanded.has(path),
    [expanded, isSearching, searchCollapsed],
  );

  const expandAll = useCallback(() => {
    if (searchStateRef.current.isSearching) {
      clearSearchCollapsed();
      return;
    }

    setExpanded(new Set(collectDirectoryPaths(tree)));
  }, [clearSearchCollapsed, tree]);

  const collapseAll = useCallback(() => {
    if (searchStateRef.current.isSearching) {
      const collapsed = collectDirectoryPaths(visibleTree);
      setSearchCollapsed(new Set(collapsed));
      return;
    }

    setExpanded((previous) => (previous.size === 0 ? previous : EMPTY_SET));
  }, [visibleTree]);

  const revealPath = useCallback((path: string) => {
    const ancestors = ancestorPaths(path);
    if (ancestors.length > 0) {
      setExpanded((previous) => {
        let changed = false;
        const next = new Set(previous);
        for (const ancestor of ancestors) {
          if (next.has(ancestor)) continue;
          next.add(ancestor);
          changed = true;
        }
        return changed ? next : previous;
      });

      setSearchCollapsed((previous) => {
        let changed = false;
        const next = new Set(previous);
        for (const ancestor of ancestors) {
          if (next.delete(ancestor)) changed = true;
        }
        return changed ? next : previous;
      });
    }

    const { isSearching: searching, query: currentQuery } =
      searchStateRef.current;
    if (
      searching &&
      !path.toLowerCase().includes(currentQuery.trim().toLowerCase())
    ) {
      // The active file is hidden by the filter: drop the filter so the tree
      // can show it again.
      clearSearchCollapsed();
      setQueryState('');
    }
  }, [clearSearchCollapsed]);

  const clearError = useCallback(() => setError(null), []);

  const readFile = useCallback(
    async (path: string, fresh = false): Promise<string> => {
      if (!fresh) {
        const cached = cacheRef.current.get(path);
        if (cached !== undefined) return cached;
      }

      const file = files.get(path);
      if (!file) throw new Error(`Файл «${path}» больше не найден в папке.`);

      const text = await file.read();
      // A new folder may have been picked while the read was running.
      if (files.get(path) === file) cacheRef.current.set(path, text);
      return text;
    },
    [files],
  );

  return {
    directory,
    files,
    paths,
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
    setSortMode,
    picking,
    error,
    clearError,
    chooseDirectory,
    readFile,
    pickerAvailable,
    truncated: directory?.truncated ?? false,
  };
}
