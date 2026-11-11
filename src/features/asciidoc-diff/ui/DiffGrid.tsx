import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';

import type { DiffRow, DiffStatus } from '../model/diff.js';
import { buildDisplayEntries } from '../model/display-rows.js';
import { inlineDiff } from '../model/inline-diff.js';
import type { RenderBlock } from '../model/render.js';
import type { Side } from '../../../shared/model/types.js';

type CellStatus = 'equal' | 'modified' | 'removed' | 'added' | 'empty';

interface DiffGridProps {
  rows: DiffRow[];
  onlyChanges: boolean;
  activeRowKey: string | null;
}

const STATUS_LABEL: Record<DiffStatus | 'empty', string> = {
  equal: 'без изменений',
  modified: 'изменено',
  added: 'добавлено',
  removed: 'удалено',
  empty: 'нет блока',
};

const cellStatus = (
  row: DiffRow,
  side: Side,
): CellStatus => {
  const block = side === 'left' ? row.left : row.right;
  if (!block) return 'empty';
  if (row.status === 'equal') return 'equal';
  if (row.status === 'modified') return 'modified';
  return side === 'left' ? 'removed' : 'added';
};

const DiffCell = ({
  block,
  side,
  status,
  html,
  active,
  rowKey,
}: {
  block: RenderBlock | null;
  side: Side;
  status: CellStatus;
  html: string | undefined;
  active: boolean;
  rowKey: string;
}) => {
  const sideLabel = side === 'left' ? 'Оригинал' : 'Изменённый';

  return (
    <div
      className={[
        'adoc-diff__cell',
        `adoc-diff__cell--${side}`,
        `adoc-diff__cell--${status}`,
        active ? 'adoc-diff__cell--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-diff-row={rowKey}
      aria-label={`${sideLabel}: ${STATUS_LABEL[status]}`}
      aria-current={active ? 'true' : undefined}
    >
      {block ? (
        <div
          className="adoc-rendered"
          dangerouslySetInnerHTML={{ __html: html ?? block.html }}
        />
      ) : null}
      <span className="adoc-diff__sr-only">{STATUS_LABEL[status]}</span>
    </div>
  );
};

const DiffRowCells = memo(function DiffRowCells({
  row,
  active,
}: {
  row: DiffRow;
  active: boolean;
}) {
  const inline = useMemo(() => {
    if (row.status !== 'modified' || !row.left || !row.right) return null;

    try {
      return inlineDiff(row.left.html, row.right.html);
    } catch {
      return null;
    }
  }, [row]);

  return (
    <Fragment>
      <DiffCell
        block={row.left}
        side="left"
        status={cellStatus(row, 'left')}
        html={inline?.leftHtml}
        active={active}
        rowKey={row.key}
      />
      <DiffCell
        block={row.right}
        side="right"
        status={cellStatus(row, 'right')}
        html={inline?.rightHtml}
        active={active}
        rowKey={row.key}
      />
    </Fragment>
  );
});

export function DiffGrid({
  rows,
  onlyChanges,
  activeRowKey,
}: DiffGridProps) {
  const entries = useMemo(
    () => buildDisplayEntries(rows, onlyChanges),
    [rows, onlyChanges],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [rows, onlyChanges]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="adoc-diff__grid">
      <div className="adoc-diff__head">Оригинал</div>
      <div className="adoc-diff__head">Изменённый</div>

      {entries.map((entry) => {
        if (entry.type === 'group') {
          const expanded = expandedGroups.has(entry.key);

          return (
            <Fragment key={entry.key}>
              <div className="adoc-diff__group">
                <span>Неизменённых блоков: {entry.rows.length}</span>
                <Button size="small" onClick={() => toggleGroup(entry.key)}>
                  {expanded ? 'Свернуть' : 'Показать'}
                </Button>
              </div>

              {expanded &&
                entry.rows.map((row) => (
                  <DiffRowCells
                    key={row.key}
                    row={row}
                    active={row.key === activeRowKey}
                  />
                ))}
            </Fragment>
          );
        }

        return (
          <DiffRowCells
            key={entry.row.key}
            row={entry.row}
            active={entry.row.key === activeRowKey}
          />
        );
      })}
    </div>
  );
}
