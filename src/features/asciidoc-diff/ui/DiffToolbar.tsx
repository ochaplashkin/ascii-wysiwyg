import {
  Button,
  ButtonGroup,
  CircularProgress,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material';

import type { DiffStats } from '../model/diff.js';
import type { Side, SourcePair } from './types.js';

interface DiffToolbarProps {
  sources: SourcePair;
  stats: DiffStats | null;
  loading: boolean;
  onlyChanges: boolean;
  onToggleOnlyChanges: (value: boolean) => void;
  onOpenSources: (side: Side) => void;
  onSwap: () => void;
  activeChange: number | null;
  changeCount: number;
  onPrev: () => void;
  onNext: () => void;
}

const Stat = ({
  tone,
  value,
  label,
}: {
  tone: 'modified' | 'added' | 'removed';
  value: number;
  label: string;
}) => (
  <span className={`adoc-diff__stat adoc-diff__stat--${tone}`}>
    <span className={`adoc-diff__stat-dot adoc-diff__stat-dot--${tone}`} />
    {label}: {value}
  </span>
);

const SourceButton = ({
  side,
  title,
  name,
  onClick,
}: {
  side: 'Оригинал' | 'Изменённый';
  title: string;
  name: string;
  onClick: () => void;
}) => (
  <Button
    size="small"
    variant="outlined"
    className="adoc-diff__source-button"
    onClick={onClick}
    title={title}
  >
    <span className="adoc-diff__source-kind">{side}</span>
    <span className="adoc-diff__source-button-name">{name}</span>
  </Button>
);

export function DiffToolbar({
  sources,
  stats,
  loading,
  onlyChanges,
  onToggleOnlyChanges,
  onOpenSources,
  onSwap,
  activeChange,
  changeCount,
  onPrev,
  onNext,
}: DiffToolbarProps) {
  const counter =
    changeCount === 0
      ? '0 / 0'
      : `${activeChange === null ? 0 : activeChange + 1} / ${changeCount}`;

  return (
    <div className="adoc-diff__toolbar">
      <div className="adoc-diff__toolbar-group">
        <SourceButton
          side="Оригинал"
          title={`Изменить оригинал: ${sources.left.name}${sources.left.path ? ` (${sources.left.path})` : ''}`}
          name={sources.left.name}
          onClick={() => onOpenSources('left')}
        />

        <Tooltip title="Поменять документы местами">
          <Button
            size="small"
            variant="outlined"
            onClick={onSwap}
            aria-label="Поменять документы местами"
            className="adoc-diff__swap-button"
          >
            ⇄
          </Button>
        </Tooltip>

        <SourceButton
          side="Изменённый"
          title={`Изменить изменённый документ: ${sources.right.name}${sources.right.path ? ` (${sources.right.path})` : ''}`}
          name={sources.right.name}
          onClick={() => onOpenSources('right')}
        />
      </div>

      <div className="adoc-diff__toolbar-group">
        {stats ? (
          <div className="adoc-diff__stats" aria-label="Статистика изменений">
            <Stat tone="modified" value={stats.modified} label="изменено" />
            <Stat tone="added" value={stats.added} label="добавлено" />
            <Stat tone="removed" value={stats.removed} label="удалено" />
          </div>
        ) : (
          <span className="adoc-diff__stats adoc-diff__stats--muted">
            Статистика…
          </span>
        )}

        <FormControlLabel
          className="adoc-diff__switch"
          control={
            <Switch
              size="small"
              checked={onlyChanges}
              onChange={(event) => onToggleOnlyChanges(event.target.checked)}
            />
          }
          label={<span className="adoc-diff__switch-label">Только изменения</span>}
        />

        <ButtonGroup
          size="small"
          variant="outlined"
          aria-label="Переход между изменениями"
        >
          <Tooltip title="Предыдущее изменение (Alt+↑)">
            <span>
              <Button
                onClick={onPrev}
                disabled={changeCount === 0}
                aria-label="Предыдущее изменение"
              >
                ‹
              </Button>
            </span>
          </Tooltip>

          <Button disabled className="adoc-diff__counter">
            {counter}
          </Button>

          <Tooltip title="Следующее изменение (Alt+↓)">
            <span>
              <Button
                onClick={onNext}
                disabled={changeCount === 0}
                aria-label="Следующее изменение"
              >
                ›
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>

        {loading && <CircularProgress size={16} />}
      </div>
    </div>
  );
}
