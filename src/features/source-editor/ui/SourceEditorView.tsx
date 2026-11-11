import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

import type { RenderOptions } from '../../asciidoc-diff/model/render.js';
import { Icon } from '../../../shared/ui/icons.js';
import { StatusBar } from '../../../shared/ui/StatusBar.js';
import { isDiagramFile } from '../../diagrams/model/file-types.js';
import { readKrokiUrl } from '../../diagrams/model/kroki-url.js';
import { dirnamePath } from '../../diagrams/model/path.js';
import { KrokiLinkButton } from '../../diagrams/ui/KrokiLinkButton.js';
import { PlantUmlPreview } from '../../diagrams/ui/PlantUmlPreview.js';
import type { DocumentSessionState } from '../../workspace/model/useDocumentSession.js';
import type { LocalFile } from '../../workspace/model/directory-access.js';
import { sourceStats } from '../model/stats.js';
import { usePreview } from '../model/usePreview.js';
import { CodeEditor } from './CodeEditor.js';
import { EditorHeader } from './EditorHeader.js';
import { NormalizationPanel } from './NormalizationPanel.js';
import { PreviewPane } from './PreviewPane.js';
import './source-editor.css';
import type { EditorMode } from './ViewSwitch.js';

const VisualEditorView = lazy(() => import('../../editor/ui/VisualEditorView.js'));

const NARROW_QUERY = '(max-width: 960px)';
const LOCAL_RESOURCE_RE = /^(?:include|image)::/m;

export interface SourceEditorViewProps {
  file: LocalFile;
  folderName: string;
  sessionState: DocumentSessionState;
  /** Reads referenced `.puml` files for `plantuml::...[]` in the preview. */
  readAsset?: (path: string) => Promise<string>;
}

const matchesNarrow = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(NARROW_QUERY).matches;
};

/** Source editor with a live preview, plus the optional visual mode. */
export function SourceEditorView({
  file,
  folderName,
  sessionState,
  readAsset,
}: SourceEditorViewProps) {
  const { session, loading, error, actions } = sessionState;

  // Build-time endpoint (or a stored override); `null` hides the Kroki link.
  const krokiUrl = useMemo(() => readKrokiUrl(), []);
  const isDiagram = isDiagramFile(file.name);

  const previewOptions = useMemo(() => {
    const options: RenderOptions = {
      baseDir: dirnamePath(file.path),
      krokiUrl,
    };
    if (readAsset) options.readAsset = readAsset;
    return options;
  }, [file.path, krokiUrl, readAsset]);

  const [mode, setMode] = useState<EditorMode>('source');
  const [mobilePane, setMobilePane] = useState<'source' | 'preview'>('source');
  const [narrow, setNarrow] = useState(matchesNarrow);
  const [split, setSplit] = useState(52);
  const [visualBaseline, setVisualBaseline] = useState('');
  const [visualDirty, setVisualDirty] = useState(false);
  const [visualRevision, setVisualRevision] = useState(0);
  const [normalization, setNormalization] = useState<{
    baseline: string;
    source: string;
  } | null>(null);
  const [reloadText, setReloadText] = useState<string | null>(null);

  const splitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(NARROW_QUERY);
    const handler = () => setNarrow(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const previewEnabled =
    !isDiagram && mode === 'source' && (!narrow || mobilePane === 'preview');
  const preview = usePreview(
    session?.source ?? '',
    previewEnabled,
    previewOptions,
  );

  const sessionReady =
    session !== null && session.path === file.path && !loading;

  const switchMode = useCallback(
    (next: EditorMode) => {
      if (isDiagram || next === mode) return;

      if (next === 'visual') {
        if (!session) return;
        setVisualBaseline(session.source);
        setVisualDirty(false);
        setNormalization(null);
        setMode('visual');
        return;
      }

      // Leaving the visual mode: only a dirty document is rebuilt by the
      // serializer, and the rebuild is always shown as a diff.
      if (visualDirty && session && session.source !== visualBaseline) {
        setNormalization({
          baseline: visualBaseline,
          source: session.source,
        });
      }
      setMode('source');
    },
    [isDiagram, mode, session, visualBaseline, visualDirty],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        actions.saveNow();
        return;
      }

      if (mod && event.key === '/' && !isDiagram) {
        event.preventDefault();
        switchMode(mode === 'source' ? 'visual' : 'source');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, isDiagram, mode, switchMode]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = splitRef.current;
    if (!container) return;

    event.preventDefault();
    const rect = container.getBoundingClientRect();

    const move = (moveEvent: PointerEvent) => {
      if (rect.width <= 0) return;
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(80, Math.max(20, percent)));
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.classList.remove('is-resizing-columns');
    };

    document.body.classList.add('is-resizing-columns');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  // The visual editor owns its Tiptap state, so actions that replace the
  // source from outside (reset draft, reload, conflict) must remount it.
  const remountVisual = (source: string) => {
    setVisualBaseline(source);
    setVisualDirty(false);
    setVisualRevision((revision) => revision + 1);
  };

  const applyDiskVersion = (text: string) => {
    actions.useDiskVersion(text);
    if (mode === 'visual') remountVisual(text);
  };

  const resetDraft = () => {
    const diskText = session?.diskText ?? '';
    actions.resetDraft();
    if (mode === 'visual') remountVisual(diskText);
  };

  const resolveConflict = (choice: 'disk' | 'draft') => {
    const target =
      choice === 'draft'
        ? (session?.conflict?.text ?? session?.source ?? '')
        : (session?.diskText ?? '');
    actions.resolveConflict(choice);
    if (mode === 'visual') remountVisual(target);
  };

  const reloadFromDisk = async () => {
    const text = await actions.reloadFromDisk();
    // Without local edits there is nothing to reconcile: take the disk text.
    if (
      session &&
      (text === session.source || session.source === session.diskText)
    ) {
      applyDiskVersion(text);
      return;
    }
    setReloadText(text);
  };

  if (error) {
    return (
      <div className="se-view">
        <div className="se-error" role="alert">
          <Icon name="warning" size={22} />
          <h2>Не удалось открыть файл</h2>
          <p>{error}</p>
          <button
            type="button"
            className="se-button se-button--primary"
            onClick={actions.retry}
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (loading || !session || session.path !== file.path) {
    return (
      <div className="se-view">
        <div className="se-loading" role="status">
          <span className="ws-spinner" aria-hidden="true" />
          Читаем файл…
        </div>
      </div>
    );
  }

  const stats = sourceStats(session.source);
  const dirty = session.hasDraft || session.source !== session.diskText;

  return (
    <div className="se-view">
      <EditorHeader
        file={file}
        folderName={folderName}
        mode={mode}
        hasDraft={dirty}
        showModeSwitch={!isDiagram}
        onModeChange={switchMode}
        onReloadFromDisk={() => void reloadFromDisk()}
        onResetDraft={resetDraft}
      />

      {session.conflict ? (
        <div className="se-banner se-banner--warning" role="alert">
          <Icon name="warning" size={18} />
          <div className="se-banner__body">
            <strong>Файл изменился на диске</strong>
            <p>
              Для этого файла есть локальный черновик, созданный из другой
              версии. Выберите, что открыть. Диск изменён не будет.
            </p>
            <div className="se-banner__actions">
              <button
                type="button"
                className="se-button se-button--primary"
                onClick={() => resolveConflict('draft')}
              >
                Оставить черновик
              </button>
              <button
                type="button"
                className="se-button"
                onClick={() => resolveConflict('disk')}
              >
                Взять версию с диска
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {session.status === 'error' ? (
        <div className="se-banner se-banner--error" role="alert">
          <Icon name="warning" size={18} />
          <div className="se-banner__body">
            <strong>Не удалось сохранить черновик</strong>
            <p>
              Хранилище браузера переполнено. Освободите место в настройках
              сайта — редактор продолжает работать в памяти, но последние
              изменения могут не сохраниться.
            </p>
          </div>
        </div>
      ) : null}

      {normalization ? (
        <NormalizationPanel
          baseline={normalization.baseline}
          source={normalization.source}
          onKeep={() => setNormalization(null)}
          onBackToVisual={() => {
            setVisualBaseline(session.source);
            setVisualDirty(false);
            setNormalization(null);
            setMode('visual');
          }}
          onDiscard={() => {
            actions.setSource(normalization.baseline);
            setNormalization(null);
          }}
        />
      ) : null}

      {mode === 'visual' && !isDiagram ? (
        <Suspense
          fallback={
            <div className="se-loading" role="status">
              <span className="ws-spinner" aria-hidden="true" />
              Загружаем визуальный редактор…
            </div>
          }
        >
          <VisualEditorView
            key={`visual-${visualRevision}`}
            initialSource={visualBaseline}
            file={file}
            onChange={actions.setSource}
            onDirtyChange={setVisualDirty}
          />
        </Suspense>
      ) : (
        <>
          {narrow ? (
            <div className="se-mobile-switch" role="group" aria-label="Область редактора">
              <button
                type="button"
                className={`se-mobile-switch__button${mobilePane === 'source' ? ' is-active' : ''}`}
                aria-pressed={mobilePane === 'source'}
                onClick={() => setMobilePane('source')}
              >
                Исходник
              </button>
              <button
                type="button"
                className={`se-mobile-switch__button${mobilePane === 'preview' ? ' is-active' : ''}`}
                aria-pressed={mobilePane === 'preview'}
                onClick={() => setMobilePane('preview')}
              >
                Предпросмотр
              </button>
            </div>
          ) : null}

          <div
            ref={splitRef}
            className={`se-split${narrow ? ' is-narrow' : ''}`}
            data-pane={mobilePane}
            style={
              narrow
                ? undefined
                : { gridTemplateColumns: `${split}% 6px minmax(0, 1fr)` }
            }
          >
            <section className="se-pane se-pane--source" aria-label="AsciiDoc-исходник">
              <div className="se-pane-head">
                <span className="se-pane-head__title">Исходник</span>
                <span className="se-pane-head__hint">AsciiDoc · редактируется</span>
              </div>
              <CodeEditor
                value={session.source}
                onChange={actions.setSource}
                onSave={actions.saveNow}
                memoryKey={file.path}
                ariaLabel={
                  isDiagram ? 'PlantUML-исходник' : 'AsciiDoc-исходник'
                }
                language={isDiagram ? 'plain' : 'asciidoc'}
              />
            </section>

            {!narrow ? (
              <div
                className="se-divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="Изменить ширину областей"
                aria-valuenow={Math.round(split)}
                aria-valuemin={20}
                aria-valuemax={80}
                tabIndex={0}
                onPointerDown={startResize}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setSplit((value) => Math.max(20, value - 4));
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    setSplit((value) => Math.min(80, value + 4));
                  }
                }}
              />
            ) : null}

            {isDiagram ? (
              <PlantUmlPreview
                source={session.source}
                url={krokiUrl}
                enabled={!narrow || mobilePane === 'preview'}
              />
            ) : (
              <PreviewPane
                state={preview}
                hasLocalResources={LOCAL_RESOURCE_RE.test(session.source)}
              />
            )}
          </div>
        </>
      )}

      <StatusBar
        lines={stats.lines}
        words={stats.words}
        characters={stats.characters}
        saveStatus={session.status}
        actions={krokiUrl ? <KrokiLinkButton url={krokiUrl} /> : null}
      />

      <Dialog
        open={reloadText !== null}
        onClose={() => setReloadText(null)}
        aria-labelledby="reload-title"
      >
        <DialogTitle id="reload-title">Файл изменился на диске</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Текущий текст в редакторе отличается от новой версии файла.
            Выберите, что делать. Запись на диск не выполняется.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReloadText(null)}>Отмена</Button>
          <Button
            onClick={() => {
              if (reloadText !== null) actions.keepDraftAsBaseline(reloadText);
              setReloadText(null);
            }}
          >
            Оставить черновик
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (reloadText !== null) applyDiskVersion(reloadText);
              setReloadText(null);
            }}
          >
            Взять версию с диска
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
