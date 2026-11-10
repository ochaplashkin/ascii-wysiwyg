import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, CircularProgress } from '@mui/material';

import { buildDiffRows, diffStats, type DiffRow } from '../model/diff.js';
import {
  renderAsciiDoc,
  type RenderBlock,
  type RenderWarning,
} from '../model/render.js';
import { DiffGrid } from './DiffGrid.js';
import { DiffToolbar } from './DiffToolbar.js';
import { DirectorySidebar } from './DirectorySidebar.js';
import { DEMO_SOURCES } from './demo-sources.js';
import { SourceDialog } from './SourceDialog.js';
import type { Side, SourcePair } from './types.js';
import './asciidoc-diff.css';

interface SideWarning extends RenderWarning {
  side: Side;
}

const errorMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

const cloneDemo = (): SourcePair => ({
  left: { ...DEMO_SOURCES.left },
  right: { ...DEMO_SOURCES.right },
});

const MAX_VISIBLE_WARNINGS = 6;

export default function AsciiDocDiffPage() {
  const [sources, setSources] = useState<SourcePair>(cloneDemo);
  const [rows, setRows] = useState<DiffRow[] | null>(null);
  const [warnings, setWarnings] = useState<SideWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState<Side | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [activeChange, setActiveChange] = useState<number | null>(null);

  const pageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;

    setLoading(true);
    setError(null);
    setRows(null);
    setWarnings([]);
    setActiveChange(null);
    setActiveRowKey(null);

    const run = async () => {
      const nextWarnings: SideWarning[] = [];
      const errors: string[] = [];
      let leftBlocks: RenderBlock[] = [];
      let rightBlocks: RenderBlock[] = [];

      try {
        const left = await renderAsciiDoc(sources.left.text, {
          idPrefix: 'left',
        });
        leftBlocks = left.blocks;
        nextWarnings.push(
          ...left.warnings.map((warning) => ({
            ...warning,
            side: 'left' as const,
          })),
        );
      } catch (reason) {
        errors.push(`Оригинал: ${errorMessage(reason)}`);
      }

      try {
        const right = await renderAsciiDoc(sources.right.text, {
          idPrefix: 'right',
        });
        rightBlocks = right.blocks;
        nextWarnings.push(
          ...right.warnings.map((warning) => ({
            ...warning,
            side: 'right' as const,
          })),
        );
      } catch (reason) {
        errors.push(`Изменённый: ${errorMessage(reason)}`);
      }

      if (requestRef.current !== requestId) return;

      if (errors.length > 0) {
        setRows(null);
        setWarnings(nextWarnings);
        setError(errors.join('\n'));
        setLoading(false);
        return;
      }

      setRows(buildDiffRows(leftBlocks, rightBlocks));
      setWarnings(nextWarnings);
      setLoading(false);
    };

    void run().catch((reason: unknown) => {
      if (requestRef.current !== requestId) return;
      setRows(null);
      setError(errorMessage(reason));
      setLoading(false);
    });
  }, [sources]);

  const stats = useMemo(() => (rows ? diffStats(rows) : null), [rows]);
  const changeRows = useMemo(
    () => rows?.filter((row) => row.status !== 'equal') ?? [],
    [rows],
  );

  const goToChange = useCallback(
    (delta: number) => {
      if (changeRows.length === 0) return;

      const next =
        activeChange === null
          ? delta > 0
            ? 0
            : changeRows.length - 1
          : Math.min(
              Math.max(activeChange + delta, 0),
              changeRows.length - 1,
            );

      const row = changeRows[next];
      if (!row) return;

      setActiveChange(next);
      setActiveRowKey(row.key);

      window.requestAnimationFrame(() => {
        const element = viewportRef.current?.querySelector<HTMLElement>(
          `[data-diff-row="${row.key}"]`,
        );
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [activeChange, changeRows],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        sourcesOpen ||
        !event.altKey ||
        (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
      ) {
        return;
      }

      // The diff tab stays mounted while the editor tab is visible. Do not
      // hijack shortcuts (or scroll a hidden panel) in that case.
      if (!pageRef.current || pageRef.current.offsetParent === null) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }

      event.preventDefault();
      goToChange(event.key === 'ArrowDown' ? 1 : -1);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToChange, sourcesOpen]);

  const swapSources = () =>
    setSources((previous) => ({
      left: previous.right,
      right: previous.left,
    }));

  return (
    <div className="adoc-diff" ref={pageRef} aria-busy={loading}>
      <DiffToolbar
        sources={sources}
        stats={stats}
        loading={loading}
        onlyChanges={onlyChanges}
        onToggleOnlyChanges={setOnlyChanges}
        onOpenSources={setSourcesOpen}
        onSwap={swapSources}
        activeChange={activeChange}
        changeCount={changeRows.length}
        onPrev={() => goToChange(-1)}
        onNext={() => goToChange(1)}
      />

      <div className="adoc-diff__body">
        <DirectorySidebar sources={sources} onApply={setSources} />

        <div className="adoc-diff__main">
          {error ? (
            <Alert severity="error" className="adoc-diff__alert">
              Не удалось отрендерить документы:
              {'\n'}
              {error}
            </Alert>
          ) : null}

          {!error && warnings.length > 0 ? (
            <Alert severity="warning" className="adoc-diff__alert">
              <strong>Сообщения Asciidoctor</strong>
              <ul className="adoc-diff__warning-list">
                {warnings
                  .slice(0, MAX_VISIBLE_WARNINGS)
                  .map((warning, index) => (
                    <li key={`${warning.side}-${index}`}>
                      {warning.side === 'left' ? 'Оригинал' : 'Изменённый'}:{' '}
                      {warning.severity}: {warning.text}
                      {warning.line ? ` (строка ${warning.line})` : ''}
                    </li>
                  ))}
              </ul>
              {warnings.length > MAX_VISIBLE_WARNINGS ? (
                <span>…и ещё {warnings.length - MAX_VISIBLE_WARNINGS}</span>
              ) : null}
            </Alert>
          ) : null}

          {!error &&
          !onlyChanges &&
          rows &&
          rows.length > 0 &&
          stats?.changes === 0 ? (
            <Alert severity="success" className="adoc-diff__alert">
              Документы идентичны — различий нет.
            </Alert>
          ) : null}

          {loading ? (
            <div className="adoc-diff__status">
              <CircularProgress size={22} />
              <span>Рендерим документы…</span>
            </div>
          ) : error ? (
            <div className="adoc-diff__status adoc-diff__status--error">
              Сравнение не построено. Исправьте документы и примените источники
              заново.
            </div>
          ) : rows && rows.length > 0 ? (
            onlyChanges && stats?.changes === 0 ? (
              <div className="adoc-diff__status">Изменений нет.</div>
            ) : (
              <div className="adoc-diff__viewport" ref={viewportRef}>
                <DiffGrid
                  rows={rows}
                  onlyChanges={onlyChanges}
                  activeRowKey={activeRowKey}
                />
              </div>
            )
          ) : (
            <div className="adoc-diff__status">
              В документах нет содержимого.
            </div>
          )}
        </div>
      </div>

      {sourcesOpen ? (
        <SourceDialog
          initial={sources}
          focusSide={sourcesOpen}
          onApply={(next) => {
            setSources(next);
            setSourcesOpen(null);
          }}
          onClose={() => setSourcesOpen(null)}
        />
      ) : null}
    </div>
  );
}
