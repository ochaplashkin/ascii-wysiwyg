import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, CircularProgress, Tooltip } from '@mui/material';

import {
  SUPPORTED_EXTENSIONS,
  buildFileTree,
  collectDirectoryPaths,
  fileCountLabel,
  filterPaths,
  type TreeNode,
} from '../model/directory-tree.js';
import {
  EMPTY_SELECTION,
  clearSlot,
  isComplete,
  selectFile as applyFileSelection,
  slotFor,
  swapSelection,
  type CompleteSelection,
  type FileSelection,
  type FileSlot,
} from '../model/file-selection.js';
import {
  canPickDirectory,
  pickLocalDirectory,
  type LocalDirectory,
  type LocalFile,
} from './directory-access.js';
import type { SourceDoc, SourcePair } from './types.js';

interface DirectorySidebarProps {
  sources: SourcePair;
  onApply: (next: SourcePair) => void;
}

const errorMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

const selectionKey = (pair: CompleteSelection) =>
  `${pair.left}\u0000${pair.right}`;

const toSource = (file: LocalFile, text: string): SourceDoc => ({
  name: file.name,
  text,
  path: file.path,
});

const FolderIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M1.75 2A1.75 1.75 0 0 0 0 3.75v8.5C0 13.22.78 14 1.75 14h12.5c.97 0 1.75-.78 1.75-1.75v-6.5c0-.97-.78-1.75-1.75-1.75H8.19L6.62 2.44A1.75 1.75 0 0 0 5.38 2H1.75Zm0 1.5h3.63c.07 0 .14.03.19.08L7.53 5.6c.14.14.33.22.53.22h6.19c.14 0 .25.11.25.25v6.18c0 .14-.11.25-.25.25H1.75a.25.25 0 0 1-.25-.25v-8.5c0-.14.11-.25.25-.25Z"
    />
  </svg>
);

export function DirectorySidebar({ sources, onApply }: DirectorySidebarProps) {
  const [directory, setDirectory] = useState<LocalDirectory | null>(null);
  const [picking, setPicking] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [selection, setSelection] = useState<FileSelection>(EMPTY_SELECTION);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const comparingRef = useRef(false);
  const pickingRef = useRef(false);
  const pendingPairRef = useRef<CompleteSelection | null>(null);
  /** Pair already shown in the diff, so the effect does not render it twice. */
  const appliedPairRef = useRef<string | null>(null);

  const pickerAvailable = useMemo(() => canPickDirectory(), []);

  const paths = useMemo(
    () => directory?.files.map((file) => file.path) ?? [],
    [directory],
  );

  const filesByPath = useMemo(() => {
    const map = new Map<string, LocalFile>();
    for (const file of directory?.files ?? []) map.set(file.path, file);
    return map;
  }, [directory]);

  const tree = useMemo(() => buildFileTree(paths), [paths]);

  const visibleTree = useMemo(
    () => (query.trim() ? buildFileTree(filterPaths(paths, query)) : tree),
    [paths, query, tree],
  );

  const currentPaths = useMemo(
    () =>
      new Set(
        [sources.left.path, sources.right.path].filter(
          (path): path is string => typeof path === 'string',
        ),
      ),
    [sources],
  );

  const isSearching = query.trim().length > 0;
  const isOpen = (path: string) => isSearching || expanded.has(path);

  const chooseDirectory = useCallback(async () => {
    // A ref guard stops a double click from opening two native dialogs before
    // React has re-rendered the disabled button.
    if (pickingRef.current) return;
    pickingRef.current = true;

    setPicking(true);
    setError(null);

    try {
      const next = await pickLocalDirectory();
      if (!next) return;

      setDirectory(next);
      setSelection(EMPTY_SELECTION);
      setQuery('');
      appliedPairRef.current = null;
      pendingPairRef.current = null;
      setExpanded(
        new Set(collectDirectoryPaths(buildFileTree(next.files.map((f) => f.path)))),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }, []);

  const toggleDirectory = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const runComparison = useCallback(
    async (pair: CompleteSelection) => {
      if (comparingRef.current) {
        // A newer pair was picked while the previous files were read; run it
        // as soon as the current read finishes.
        pendingPairRef.current = pair;
        return;
      }

      const left = filesByPath.get(pair.left);
      const right = filesByPath.get(pair.right);
      if (!left || !right) return;

      comparingRef.current = true;
      setComparing(true);
      setError(null);

      try {
        const [leftText, rightText] = await Promise.all([
          left.read(),
          right.read(),
        ]);
        onApply({
          left: toSource(left, leftText),
          right: toSource(right, rightText),
        });
        appliedPairRef.current = selectionKey(pair);
      } catch (reason) {
        setError(`Не удалось прочитать файлы: ${errorMessage(reason)}`);
      } finally {
        comparingRef.current = false;
        setComparing(false);

        const pending = pendingPairRef.current;
        pendingPairRef.current = null;
        if (pending) void runComparison(pending);
      }
    },
    [filesByPath, onApply],
  );

  // Selecting the second file starts the comparison right away, reusing the
  // same diff pipeline as the manual "Сравнить" action.
  useEffect(() => {
    if (!isComplete(selection)) return;
    if (appliedPairRef.current === selectionKey(selection)) return;

    void runComparison(selection);
  }, [runComparison, selection]);

  const compare = useCallback(() => {
    if (!isComplete(selection)) return;
    void runComparison(selection);
  }, [runComparison, selection]);

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode => (
    <ul className="adoc-diff__tree">
      {nodes.map((node) => {
        if (node.type === 'directory') {
          const open = isOpen(node.path);
          return (
            <li key={node.path}>
              <button
                type="button"
                className="adoc-diff__tree-dir"
                style={{ paddingLeft: 8 + depth * 14 }}
                aria-expanded={open}
                onClick={() => toggleDirectory(node.path)}
              >
                <span className="adoc-diff__tree-chevron" aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
                <span className="adoc-diff__tree-name">{node.name}</span>
              </button>
              {open ? renderNodes(node.children, depth + 1) : null}
            </li>
          );
        }

        const slot = slotFor(selection, node.path);
        const isCurrent = currentPaths.has(node.path);

        return (
          <li key={node.path}>
            <button
              type="button"
              className={[
                'adoc-diff__file-row',
                slot ? `adoc-diff__file-row--${slot}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ paddingLeft: 8 + depth * 14 + 10 }}
              title={
                isCurrent
                  ? `${node.path} — сейчас сравнивается`
                  : node.path
              }
              aria-pressed={slot !== null}
              aria-label={[
                node.path,
                slot === 'left'
                  ? 'выбран как оригинал'
                  : slot === 'right'
                    ? 'выбран как изменённый'
                    : '',
              ]
                .filter(Boolean)
                .join(', ')}
              onClick={() =>
                setSelection((previous) =>
                  applyFileSelection(previous, node.path),
                )
              }
            >
              <span className="adoc-diff__file-name">
                {isSearching ? node.path : node.name}
              </span>
              {isCurrent ? (
                <span
                  className="adoc-diff__file-current"
                  title="Сейчас сравнивается"
                  aria-hidden="true"
                />
              ) : null}
              {slot ? (
                <span
                  className={`adoc-diff__file-slot adoc-diff__file-slot--${slot}`}
                  title={slot === 'left' ? 'Оригинал' : 'Изменённый'}
                  aria-hidden="true"
                >
                  {slot === 'left' ? 'A' : 'B'}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderSlot = (slot: FileSlot) => {
    const path = selection[slot];
    const file = path ? filesByPath.get(path) : undefined;
    const label = slot === 'left' ? 'Оригинал' : 'Изменённый';

    return (
      <div
        className={`adoc-diff__slot adoc-diff__slot--${slot}`}
        data-filled={file ? 'true' : undefined}
      >
        <span className="adoc-diff__slot-tag" title={label}>
          {slot === 'left' ? 'A' : 'B'}
        </span>
        <span className="adoc-diff__slot-text" title={path ?? label}>
          {file ? file.name : `Не выбран (${label.toLowerCase()})`}
        </span>
        {file ? (
          <button
            type="button"
            className="adoc-diff__slot-clear"
            onClick={() =>
              setSelection((previous) => clearSlot(previous, slot))
            }
            aria-label={`Убрать файл из слота «${label}»`}
            title="Убрать"
          >
            ×
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="adoc-diff__sidebar" aria-label="Выбор файлов на диске">
      <div className="adoc-diff__sidebar-head">
        <span className="adoc-diff__sidebar-title">Файлы на диске</span>
        {directory ? (
          <Button
            size="small"
            variant="outlined"
            className="adoc-diff__sidebar-pick"
            onClick={() => void chooseDirectory()}
            disabled={picking}
          >
            {picking ? <CircularProgress size={14} /> : 'Сменить'}
          </Button>
        ) : null}
      </div>

      {directory ? (
        <>
          <div className="adoc-diff__sidebar-dir" title={directory.name}>
            <span className="adoc-diff__sidebar-dir-icon">
              <FolderIcon />
            </span>
            <span className="adoc-diff__sidebar-dir-name">
              {directory.name}
            </span>
            <span className="adoc-diff__sidebar-dir-meta">
              {fileCountLabel(directory.files.length)}
            </span>
          </div>

          {directory.files.length > 0 ? (
            <>
              <input
                className="adoc-diff__sidebar-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setQuery('');
                }}
                placeholder="Фильтр по имени"
                aria-label="Фильтр файлов по имени"
                spellCheck={false}
              />

              <div className="adoc-diff__sidebar-scroll">
                {visibleTree.length > 0 ? (
                  renderNodes(visibleTree, 0)
                ) : (
                  <p className="adoc-diff__sidebar-note">
                    Ничего не найдено по запросу «{query.trim()}».
                  </p>
                )}

                {directory.truncated ? (
                  <p className="adoc-diff__sidebar-note">
                    Показаны первые {directory.files.length} файлов — выберите
                    папку с меньшим количеством документов.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="adoc-diff__sidebar-empty">
              <p>В папке нет подходящих файлов.</p>
              <p className="adoc-diff__sidebar-hint">
                Поддерживаются {SUPPORTED_EXTENSIONS.join(', ')}.
              </p>
            </div>
          )}

          {error ? (
            <Alert
              severity="error"
              className="adoc-diff__sidebar-alert"
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          ) : null}

          <div className="adoc-diff__sidebar-footer">
            <div className="adoc-diff__slots">
              {renderSlot('left')}
              {renderSlot('right')}
            </div>

            <div className="adoc-diff__sidebar-actions">
              <Tooltip title="Поменять файлы местами">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    className="adoc-diff__swap-button"
                    onClick={() =>
                      setSelection((previous) => swapSelection(previous))
                    }
                    disabled={!selection.left && !selection.right}
                    aria-label="Поменять файлы местами"
                  >
                    ⇄
                  </Button>
                </span>
              </Tooltip>

              <Button
                size="small"
                variant="contained"
                fullWidth
                className="adoc-diff__compare-button"
                onClick={compare}
                disabled={!isComplete(selection) || comparing}
              >
                {comparing ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  'Сравнить'
                )}
              </Button>
            </div>

            <p className="adoc-diff__sidebar-hint">
              Клик по файлу — в свободный слот. Как только выбраны два файла,
              сравнение запускается автоматически.
            </p>
          </div>
        </>
      ) : (
        <div className="adoc-diff__sidebar-empty">
          <p>
            Выберите папку на локальном диске, затем два файла для сравнения.
          </p>

          {!pickerAvailable ? (
            <p className="adoc-diff__sidebar-warning">
              Браузер не поддерживает выбор папки. Откройте приложение в
              актуальной версии Chrome, Edge, Firefox или Safari.
            </p>
          ) : null}

          <Button
            size="small"
            variant="contained"
            className="adoc-diff__sidebar-pick"
            onClick={() => void chooseDirectory()}
            disabled={picking}
          >
            {picking ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <>
                <FolderIcon />
                Выбрать папку
              </>
            )}
          </Button>

          {error ? (
            <Alert
              severity="error"
              className="adoc-diff__sidebar-alert"
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          ) : null}

          <p className="adoc-diff__sidebar-hint">
            Поддерживаются {SUPPORTED_EXTENSIONS.join(', ')}. Файлы читаются
            локально и не отправляются на сервер.
          </p>
        </div>
      )}
    </aside>
  );
}
