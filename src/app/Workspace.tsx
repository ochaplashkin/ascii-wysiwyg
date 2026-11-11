import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import type { SourceDoc, SourcePair } from '../shared/model/types.js';
import { Icon } from '../shared/ui/icons.js';
import { SourceEditorView } from '../features/source-editor/ui/SourceEditorView.js';
import {
  EMPTY_SELECTION,
  clearSlot,
  isComplete,
  swapSelection,
  toggleSelection,
  type FileSelection,
  type FileSlot,
} from '../features/workspace/model/file-selection.js';
import {
  hashText,
  listDraftPaths,
  loadDraft,
} from '../features/workspace/model/drafts.js';
import {
  readStoredSidebarWidth,
  storeSidebarWidth,
} from '../features/workspace/model/sidebar-layout.js';
import { useDirectorySession } from '../features/workspace/model/useDirectorySession.js';
import { useDocumentSession } from '../features/workspace/model/useDocumentSession.js';
import { EmptyWorkspace } from '../features/workspace/ui/EmptyWorkspace.js';
import { SidebarRail } from '../features/workspace/ui/SidebarRail.js';
import { SidebarResizer } from '../features/workspace/ui/SidebarResizer.js';
import { WorkspaceSidebar } from '../features/workspace/ui/WorkspaceSidebar.js';

const LazyCompareView = lazy(
  () => import('../features/asciidoc-diff/ui/CompareView.js'),
);

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

/**
 * Single-workspace shell: a permanent file sidebar and one main area that
 * switches between the empty state, the editor and the comparison.
 */
export function Workspace() {
  const directorySession = useDirectorySession();

  const [selection, setSelection] = useState<FileSelection>(EMPTY_SELECTION);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<SourcePair | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredSidebarWidth(),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [draftPaths, setDraftPaths] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const compareInFlightRef = useRef(false);
  const railButtonRef = useRef<HTMLButtonElement>(null);
  const wasCollapsedRef = useRef(false);

  const activeFile = activePath
    ? (directorySession.files.get(activePath) ?? null)
    : null;

  const documentState = useDocumentSession(
    activeFile,
    directorySession.directory?.name ?? '',
    directorySession.readFile,
  );

  // A new folder resets everything that referred to the previous one. Drafts
  // in localStorage stay, but the session itself is never restored.
  useEffect(() => {
    setSelection(EMPTY_SELECTION);
    setActivePath(null);
    setComparePair(null);
    setCompareError(null);
    setSidebarOpen(false);
  }, [directorySession.directory]);

  const folderName = directorySession.directory?.name ?? '';

  useEffect(() => {
    if (!folderName) {
      setDraftPaths(new Set<string>());
      return;
    }
    setDraftPaths(new Set(listDraftPaths(folderName)));
  }, [folderName]);

  // Keep the draft dot of the open file in sync: a local change counts even
  // before the 500 ms autosave has written it to localStorage.
  useEffect(() => {
    const session = documentState.session;
    const path = session?.path;
    if (!session || !path) return;

    const hasDraft = session.hasDraft || session.source !== session.diskText;
    setDraftPaths((previous) => {
      if (previous.has(path) === hasDraft) return previous;
      const next = new Set(previous);
      if (hasDraft) next.add(path);
      else next.delete(path);
      return next;
    });
  }, [
    documentState.session?.hasDraft,
    documentState.session?.path,
    documentState.session?.source,
    documentState.session?.diskText,
  ]);

  // Referenced diagrams must use the same text the editor shows. The app
  // never writes to disk, so a puml edit lives in a draft; prefer that draft
  // when it was created from the current disk revision.
  const readAsset = useCallback(
    async (path: string): Promise<string> => {
      const diskText = await directorySession.readFile(path);
      const draft = loadDraft(folderName, path);
      if (
        draft &&
        draft.baseHash === hashText(diskText) &&
        draft.text !== diskText
      ) {
        return draft.text;
      }
      return diskText;
    },
    [directorySession.readFile, folderName],
  );

  const openFile = useCallback((path: string) => {
    setActivePath(path);
    setComparePair(null);
    setCompareError(null);
    setSidebarOpen(false);
  }, []);

  const toggleFile = useCallback((path: string) => {
    setSelection((previous) => toggleSelection(previous, path));
    setCompareError(null);
  }, []);

  const clearSelectionSlot = useCallback((slot: FileSlot) => {
    setSelection((previous) => clearSlot(previous, slot));
  }, []);

  const swapPendingSelection = useCallback(() => {
    setSelection((previous) => swapSelection(previous));
  }, []);

  const compare = useCallback(async () => {
    if (!isComplete(selection) || compareInFlightRef.current) return;

    const pair = { left: selection.left, right: selection.right };
    const leftFile = directorySession.files.get(pair.left);
    const rightFile = directorySession.files.get(pair.right);
    if (!leftFile || !rightFile) {
      setCompareError('Один из выбранных файлов больше не доступен.');
      return;
    }

    compareInFlightRef.current = true;
    setComparing(true);
    setCompareError(null);

    try {
      const [leftText, rightText] = await Promise.all([
        directorySession.readFile(pair.left),
        directorySession.readFile(pair.right),
      ]);

      const left: SourceDoc = {
        name: leftFile.name,
        path: pair.left,
        text: leftText,
      };
      const right: SourceDoc = {
        name: rightFile.name,
        path: pair.right,
        text: rightText,
      };

      setComparePair({ left, right });
    } catch (reason) {
      setCompareError(
        `Не удалось прочитать файлы: ${errorMessage(reason)}`,
      );
    } finally {
      compareInFlightRef.current = false;
      setComparing(false);
    }
  }, [directorySession, selection]);

  const swapComparedPair = useCallback(() => {
    if (!comparePair) return;

    setSelection((currentSelection) =>
      currentSelection.left === comparePair.left.path &&
      currentSelection.right === comparePair.right.path
        ? swapSelection(currentSelection)
        : currentSelection,
    );
    setComparePair({ left: comparePair.right, right: comparePair.left });
  }, [comparePair]);

  const closeCompare = useCallback(() => {
    setComparePair(null);
  }, []);

  const changeSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width);
  }, []);

  const commitSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width);
    storeSidebarWidth(width);
  }, []);

  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), []);
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), []);

  // Focus follows the panel state: the rail button after collapsing, the
  // previously focused tree row (or the first control) after expanding.
  useEffect(() => {
    if (sidebarCollapsed) {
      railButtonRef.current?.focus();
    } else if (wasCollapsedRef.current) {
      const sidebar = document.getElementById('workspace-sidebar');
      const target =
        sidebar?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ??
        sidebar?.querySelector<HTMLElement>('.ws-search input') ??
        sidebar?.querySelector<HTMLElement>('button, input');
      target?.focus();
    }

    wasCollapsedRef.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  const hasDirectory = directorySession.directory !== null;

  return (
    <div
      className={`workspace-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <WorkspaceSidebar
        directorySession={directorySession}
        selection={selection}
        activePath={activePath}
        draftPaths={draftPaths}
        comparing={comparing}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        onOpenFile={openFile}
        onToggleFile={toggleFile}
        onClearSlot={clearSelectionSlot}
        onSwap={swapPendingSelection}
        onCompare={() => void compare()}
        compareError={compareError}
        onDismissCompareError={() => setCompareError(null)}
        onCollapseSidebar={collapseSidebar}
        resizer={
          <SidebarResizer
            width={sidebarWidth}
            onChange={changeSidebarWidth}
            onCommit={commitSidebarWidth}
          />
        }
      />

      {sidebarCollapsed ? (
        <SidebarRail onExpand={expandSidebar} buttonRef={railButtonRef} />
      ) : null}

      {sidebarOpen ? (
        <button
          type="button"
          className="workspace-backdrop"
          aria-label="Закрыть панель файлов"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="workspace-main">
        <div className="ws-mobile-bar">
          <button
            type="button"
            className="ws-mobile-bar__button"
            aria-label="Открыть панель файлов"
            aria-controls="workspace-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
          <span className="ws-mobile-bar__title">
            {activeFile?.name ?? directorySession.directory?.name ?? 'AsciiDoc'}
          </span>
        </div>

        {comparePair ? (
          <Suspense
            fallback={
              <div className="se-loading" role="status">
                <span className="ws-spinner" aria-hidden="true" />
                Загружаем сравнение…
              </div>
            }
          >
            <LazyCompareView
              left={comparePair.left}
              right={comparePair.right}
              onSwap={swapComparedPair}
              onClose={closeCompare}
              onOpenFile={openFile}
              readAsset={readAsset}
            />
          </Suspense>
        ) : activeFile ? (
          <SourceEditorView
            key={activeFile.path}
            file={activeFile}
            folderName={folderName}
            sessionState={documentState}
            readAsset={readAsset}
          />
        ) : (
          <EmptyWorkspace
            hasDirectory={hasDirectory}
            picking={directorySession.picking}
            pickerAvailable={directorySession.pickerAvailable}
            onPick={() => void directorySession.chooseDirectory()}
          />
        )}
      </main>
    </div>
  );
}
