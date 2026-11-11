import { Icon } from '../../../shared/ui/icons.js';
import { SUPPORTED_EXTENSIONS } from '../model/directory-tree.js';
import type { DirectorySession } from '../model/useDirectorySession.js';
import type { FileSelection, FileSlot } from '../model/file-selection.js';
import { CompareSlots } from './CompareSlots.js';
import { FileTree } from './FileTree.js';
import { FolderHeader } from './FolderHeader.js';

export interface WorkspaceSidebarProps {
  directorySession: DirectorySession;
  selection: FileSelection;
  activePath: string | null;
  draftPaths: ReadonlySet<string>;
  comparing: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenFile: (path: string) => void;
  onToggleFile: (path: string) => void;
  onClearSlot: (slot: FileSlot) => void;
  onSwap: () => void;
  onCompare: () => void;
  compareError: string | null;
  onDismissCompareError: () => void;
}

/** Persistent file panel: folder, search, tree, compare slots. */
export function WorkspaceSidebar({
  directorySession,
  selection,
  activePath,
  draftPaths,
  comparing,
  mobileOpen,
  onCloseMobile,
  onOpenFile,
  onToggleFile,
  onClearSlot,
  onSwap,
  onCompare,
  compareError,
  onDismissCompareError,
}: WorkspaceSidebarProps) {
  const {
    directory,
    visibleTree,
    query,
    setQuery,
    isSearching,
    expanded,
    toggleDirectory,
    picking,
    error,
    clearError,
    chooseDirectory,
    files,
    pickerAvailable,
    truncated,
  } = directorySession;

  const hasFiles = (directory?.files.length ?? 0) > 0;

  return (
    <aside
      id="workspace-sidebar"
      className={`ws-sidebar${mobileOpen ? ' is-open' : ''}`}
      aria-label="Файлы рабочей области"
    >
      <button
        type="button"
        className="ws-sidebar__close"
        onClick={onCloseMobile}
        aria-label="Закрыть панель файлов"
      >
        <Icon name="close" size={18} />
      </button>

      <FolderHeader
        directory={directory}
        picking={picking}
        onChoose={() => void chooseDirectory()}
      />

      {directory ? (
        hasFiles ? (
          <>
            <div className="ws-search">
              <Icon name="search" size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setQuery('');
                }}
                placeholder="Фильтр файлов"
                aria-label="Фильтр файлов по пути"
                spellCheck={false}
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  className="ws-search__clear"
                  onClick={() => setQuery('')}
                  aria-label="Очистить фильтр"
                >
                  <Icon name="close" size={12} />
                </button>
              ) : null}
            </div>

            <div className="ws-tree-scroll">
              {visibleTree.length > 0 ? (
                <FileTree
                  nodes={visibleTree}
                  activePath={activePath}
                  selection={selection}
                  draftPaths={draftPaths}
                  expanded={expanded}
                  isSearching={isSearching}
                  onToggleDirectory={toggleDirectory}
                  onOpenFile={onOpenFile}
                  onToggleFile={onToggleFile}
                />
              ) : (
                <p className="ws-note">
                  Ничего не найдено по запросу «{query.trim()}».
                </p>
              )}

              {truncated ? (
                <p className="ws-note ws-note--warning">
                  Показаны первые {directory.files.length} файлов. Выберите
                  папку с меньшим количеством документов, чтобы увидеть
                  остальные.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="ws-empty-panel">
            <p>В папке нет подходящих файлов.</p>
            <p className="ws-hint">
              Поддерживаются {SUPPORTED_EXTENSIONS.join(', ')}.
            </p>
            <button
              type="button"
              className="ws-button ws-button--outline"
              onClick={() => void chooseDirectory()}
              disabled={picking}
            >
              Выбрать другую папку
            </button>
          </div>
        )
      ) : (
        <div className="ws-empty-panel">
          <p>
            Выберите папку с документами. Файлы читаются локально и не
            отправляются на сервер.
          </p>
          <button
            type="button"
            className="ws-button ws-button--primary"
            onClick={() => void chooseDirectory()}
            disabled={picking}
          >
            {picking ? (
              <span className="ws-spinner" aria-hidden="true" />
            ) : (
              <Icon name="folder" size={15} />
            )}
            <span>{picking ? 'Открываем…' : 'Выбрать папку'}</span>
          </button>
          <p className="ws-hint">
            Поддерживаются {SUPPORTED_EXTENSIONS.join(', ')}.
          </p>
          {!pickerAvailable ? (
            <p className="ws-note ws-note--warning">
              Браузер не поддерживает выбор папки. Откройте приложение в
              актуальной версии Chrome, Edge, Firefox или Safari.
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <div className="ws-alert ws-alert--error" role="alert">
          <Icon name="warning" size={14} />
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Скрыть сообщение об ошибке"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}

      {compareError ? (
        <div className="ws-alert ws-alert--error" role="alert">
          <Icon name="warning" size={14} />
          <span>{compareError}</span>
          <button
            type="button"
            onClick={onDismissCompareError}
            aria-label="Скрыть сообщение об ошибке"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}

      {hasFiles ? (
        <footer className="ws-sidebar__footer">
          <CompareSlots
            selection={selection}
            files={files}
            comparing={comparing}
            onClear={onClearSlot}
            onSwap={onSwap}
            onCompare={onCompare}
          />
        </footer>
      ) : null}
    </aside>
  );
}
