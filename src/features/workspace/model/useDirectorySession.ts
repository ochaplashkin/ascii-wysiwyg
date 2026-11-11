import { useCallback, useMemo, useRef, useState } from 'react';

import {
  canPickDirectory,
  pickLocalDirectory,
  type LocalDirectory,
  type LocalFile,
} from './directory-access.js';
import {
  buildFileTree,
  collectDirectoryPaths,
  filterPaths,
  type TreeNode,
} from './directory-tree.js';

export interface DirectorySession {
  directory: LocalDirectory | null;
  files: ReadonlyMap<string, LocalFile>;
  paths: string[];
  tree: TreeNode[];
  visibleTree: TreeNode[];
  query: string;
  setQuery: (value: string) => void;
  isSearching: boolean;
  expanded: ReadonlySet<string>;
  isOpen: (path: string) => boolean;
  toggleDirectory: (path: string) => void;
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

/**
 * Owns the picked directory: the native picker, the file tree, search and the
 * text cache. Every file read is local; nothing is sent to a server.
 */
export function useDirectorySession(): DirectorySession {
  const [directory, setDirectory] = useState<LocalDirectory | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const pickingRef = useRef(false);
  const cacheRef = useRef(new Map<string, string>());

  const pickerAvailable = useMemo(() => canPickDirectory(), []);

  const paths = useMemo(
    () => directory?.files.map((file) => file.path) ?? [],
    [directory],
  );

  const files = useMemo(() => {
    const map = new Map<string, LocalFile>();
    for (const file of directory?.files ?? []) map.set(file.path, file);
    return map;
  }, [directory]);

  const tree = useMemo(() => buildFileTree(paths), [paths]);

  const isSearching = query.trim().length > 0;

  // While searching every directory is expanded so relative matches stay
  // visible regardless of the manual collapse state.
  const visibleTree = useMemo(
    () => (isSearching ? buildFileTree(filterPaths(paths, query)) : tree),
    [isSearching, paths, query, tree],
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
      setQuery('');
      setExpanded(
        new Set(
          collectDirectoryPaths(buildFileTree(next.files.map((file) => file.path))),
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }, []);

  const toggleDirectory = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const isOpen = useCallback(
    (path: string) => isSearching || expanded.has(path),
    [expanded, isSearching],
  );

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
    tree,
    visibleTree,
    query,
    setQuery,
    isSearching,
    expanded,
    isOpen,
    toggleDirectory,
    picking,
    error,
    clearError,
    chooseDirectory,
    readFile,
    pickerAvailable,
    truncated: directory?.truncated ?? false,
  };
}
