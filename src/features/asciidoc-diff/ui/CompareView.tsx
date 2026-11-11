import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, CircularProgress } from '@mui/material';

import type { SourceDoc, SourcePair } from '../../../shared/model/types.js';
import { buildDiffRows, diffStats, type DiffRow } from '../model/diff.js';
import {
  renderAsciiDoc,
  type RenderBlock,
  type RenderWarning,
} from '../model/render.js';
import { DiffGrid } from './DiffGrid.js';
import { DiffToolbar } from './DiffToolbar.js';
import '../../../shared/ui/asciidoc-content.css';
import './asciidoc-diff.css';

interface SideWarning extends RenderWarning {
  side: 'left' | 'right';
}

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

const MAX_VISIBLE_WARNINGS = 6;

export interface CompareViewProps {
  left: SourceDoc;
  right: SourceDoc;
  onSwap: () => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

/**
 * Read-only side-by-side comparison of two files. The diff engine is the
 * existing block renderer + LCS diff; only the surrounding UI changed.
 */
export default function CompareView({
  left,
  right,
  onSwap,
  onClose,
  onOpenFile,
}: CompareViewProps) {
  const sources: SourcePair = useMemo(
    () => ({ left, right }),
    [left, right],
  );

  const [rows, setRows] = useState<DiffRow[] | null>(null);
  const [warnings, setWarnings] = useState<SideWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [activeChange, setActiveChange] = useState<number | null>(null);

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
        const rendered = await renderAsciiDoc(sources.left.text, {
          idPrefix: 'left',
        });
        leftBlocks = rendered.blocks;
        nextWarnings.push(
          ...rendered.warnings.map((warning) => ({
            ...warning,
            side: 'left' as const,
          })),
        );
      } catch (reason) {
        errors.push(`Файл A: ${errorMessage(reason)}`);
      }

      try {
        const rendered = await renderAsciiDoc(sources.right.text, {
          idPrefix: 'right',
        });
        rightBlocks = rendered.blocks;
        nextWarnings.push(
          ...rendered.warnings.map((warning) => ({
            ...warning,
            side: 'right' as const,
          })),
        );
      } catch (reason) {
        errors.push(`Файл B: ${errorMessage(reason)}`);
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
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (!event.altKey) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      event.preventDefault();
      goToChange(event.key === 'ArrowDown' ? 1 : -1);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToChange, onClose]);

  return (
    <div className="adoc-diff" aria-busy={loading}>
      <DiffToolbar
        sources={sources}
        stats={stats}
        loading={loading}
        onlyChanges={onlyChanges}
        onToggleOnlyChanges={setOnlyChanges}
        onOpenFile={onOpenFile}
        onSwap={onSwap}
        onClose={onClose}
        activeChange={activeChange}
        changeCount={changeRows.length}
        onPrev={() => goToChange(-1)}
        onNext={() => goToChange(1)}
      />

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
                    {warning.side === 'left' ? 'A' : 'B'}: {warning.severity}:{' '}
                    {warning.text}
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
            Сравнение не построено. Проверьте документы и откройте файлы в
            редакторе.
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
  );
}
