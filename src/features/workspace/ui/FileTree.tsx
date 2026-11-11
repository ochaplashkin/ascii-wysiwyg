import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { ancestorPaths, type TreeNode } from '../model/directory-tree.js';
import {
  canToggle,
  slotFor,
  type FileSelection,
} from '../model/file-selection.js';
import { flattenTree } from '../model/tree-view.js';
import { FileRow } from './FileRow.js';
import { FolderRow } from './FolderRow.js';

export interface FileTreeProps {
  nodes: readonly TreeNode[];
  activePath: string | null;
  selection: FileSelection;
  draftPaths: ReadonlySet<string>;
  isOpen: (path: string) => boolean;
  query: string;
  compact: boolean;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onToggleFile: (path: string) => void;
}

const scrollIntoView = (element: HTMLElement | undefined) => {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  element.scrollIntoView({ block: 'nearest' });
};

/**
 * Flat, keyboard-navigable file tree: one `<ul role="tree">` with a row per
 * visible node. Nested groups are rendered by `aria-level` instead of nested
 * lists, which keeps the roving tabindex simple.
 */
export function FileTree({
  nodes,
  activePath,
  selection,
  draftPaths,
  isOpen,
  query,
  compact,
  onToggleDirectory,
  onOpenFile,
  onToggleFile,
}: FileTreeProps) {
  const rows = useMemo(() => flattenTree(nodes, isOpen), [isOpen, nodes]);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  const containerRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const visiblePaths = useMemo(
    () => new Set(rows.map((row) => row.node.path)),
    [rows],
  );
  const rowIndexes = useMemo(
    () => new Map(rows.map((row, index) => [row.node.path, index])),
    [rows],
  );

  const tabStopPath = useMemo(() => {
    if (focusedPath && visiblePaths.has(focusedPath)) return focusedPath;
    if (activePath && visiblePaths.has(activePath)) return activePath;
    return rows[0]?.node.path ?? null;
  }, [activePath, focusedPath, rows, visiblePaths]);

  const setRowRef = useCallback((path: string, element: HTMLLIElement | null) => {
    if (element) rowRefs.current.set(path, element);
    else rowRefs.current.delete(path);
  }, []);

  const moveFocus = useCallback((path: string | undefined) => {
    if (!path) return;
    setFocusedPath(path);
    const element = rowRefs.current.get(path);
    if (!element) return;
    element.focus();
    scrollIntoView(element);
  }, []);

  // When the focused row disappears (its directory collapsed), move the focus
  // to the closest visible ancestor, but only while the tree owns focus.
  useEffect(() => {
    if (!focusedPath || visiblePaths.has(focusedPath)) return;

    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) return;

    const fallback =
      [...ancestorPaths(focusedPath)]
        .reverse()
        .find((path) => visiblePaths.has(path)) ??
      rows[0]?.node.path ??
      null;

    if (fallback === null) {
      setFocusedPath(null);
      return;
    }

    setFocusedPath(fallback);
    rowRefs.current.get(fallback)?.focus();
  }, [focusedPath, rows, visiblePaths]);

  // Reveal the active file by scrolling it into view (the sidebar expands its
  // ancestors itself).
  useEffect(() => {
    if (!activePath) return;
    scrollIntoView(rowRefs.current.get(activePath));
  }, [activePath, rows]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;

    const currentPath = focusedPath ?? tabStopPath;
    if (!currentPath) return;

    const index = rowIndexes.get(currentPath);
    if (index === undefined) return;

    const row = rows[index];
    if (!row) return;

    const isDirectory = row.node.type === 'directory';
    const open = isDirectory && isOpen(row.node.path);

    switch (event.key) {
      case 'ArrowDown': {
        const next = rows[index + 1];
        if (!next) return;
        event.preventDefault();
        moveFocus(next.node.path);
        return;
      }
      case 'ArrowUp': {
        const previous = rows[index - 1];
        if (!previous) return;
        event.preventDefault();
        moveFocus(previous.node.path);
        return;
      }
      case 'ArrowRight': {
        if (row.node.type !== 'directory') return;
        event.preventDefault();
        if (!open) {
          onToggleDirectory(row.node.path);
          return;
        }
        const firstChild = row.node.children[0];
        if (firstChild) moveFocus(firstChild.path);
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        if (isDirectory && open) {
          onToggleDirectory(row.node.path);
          return;
        }
        if (row.parentPath) moveFocus(row.parentPath);
        return;
      }
      case 'Home': {
        const first = rows[0];
        if (!first) return;
        event.preventDefault();
        moveFocus(first.node.path);
        return;
      }
      case 'End': {
        const last = rows[rows.length - 1];
        if (!last) return;
        event.preventDefault();
        moveFocus(last.node.path);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        if (row.node.type === 'directory') onToggleDirectory(row.node.path);
        else onOpenFile(row.node.path);
        return;
      }
      case ' ': {
        event.preventDefault();
        if (row.node.type === 'directory') {
          onToggleDirectory(row.node.path);
          return;
        }
        if (!canToggle(selection, row.node.path)) return;
        onToggleFile(row.node.path);
        return;
      }
      default:
        return;
    }
  };

  // Clicks on buttons and checkboxes keep the row as the keyboard focus
  // target, so arrow keys work right after a mouse click.
  const handleClick = (event: ReactMouseEvent<HTMLUListElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const rowElement = target.closest<HTMLLIElement>('[data-tree-path]');
    if (!rowElement) return;
    if (document.activeElement !== rowElement) rowElement.focus();
  };

  return (
    <ul
      ref={containerRef}
      className={`ws-tree${compact ? ' ws-tree--compact' : ''}`}
      role="tree"
      aria-label="Файлы и папки"
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      {rows.map((row) => {
        const { node } = row;
        const isDirectory = node.type === 'directory';
        const open = isDirectory && isOpen(node.path);
        const isActive = !isDirectory && activePath === node.path;
        const isTabStop = node.path === tabStopPath;

        return (
          <li
            key={node.path}
            ref={(element) => setRowRef(node.path, element)}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-posinset={row.posInSet}
            aria-setsize={row.setSize}
            aria-expanded={isDirectory ? open : undefined}
            aria-selected={isActive ? true : undefined}
            tabIndex={isTabStop ? 0 : -1}
            data-tree-path={node.path}
            className={`ws-tree__item${isDirectory ? ' ws-tree__item--directory' : ' ws-tree__item--file'}`}
            style={{ '--depth': row.depth } as CSSProperties}
            onFocus={() => setFocusedPath(node.path)}
          >
            {isDirectory ? (
              <FolderRow
                path={node.path}
                name={node.name}
                open={open}
                query={query}
                onToggle={onToggleDirectory}
              />
            ) : (
              <FileRow
                path={node.path}
                name={node.name}
                active={isActive}
                slot={slotFor(selection, node.path)}
                locked={!canToggle(selection, node.path)}
                hasDraft={draftPaths.has(node.path)}
                query={query}
                onOpen={onOpenFile}
                onToggle={onToggleFile}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
