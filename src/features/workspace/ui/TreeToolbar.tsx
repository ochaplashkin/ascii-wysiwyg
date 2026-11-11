import { Icon, type IconName } from '../../../shared/ui/icons.js';
import type { SortMode } from '../model/directory-tree.js';

export interface TreeToolbarProps {
  isSearching: boolean;
  visibleCount: number;
  totalCount: number;
  canExpandAll: boolean;
  canCollapseAll: boolean;
  sortMode: SortMode;
  compact: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleSort: () => void;
  onToggleDensity: () => void;
}

interface ToolButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}

function ToolButton({
  icon,
  label,
  onClick,
  disabled = false,
  pressed,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className="ws-tool-button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

/** Toolbar between the search box and the file tree. */
export function TreeToolbar({
  isSearching,
  visibleCount,
  totalCount,
  canExpandAll,
  canCollapseAll,
  sortMode,
  compact,
  onExpandAll,
  onCollapseAll,
  onToggleSort,
  onToggleDensity,
}: TreeToolbarProps) {
  const sortLabel =
    sortMode === 'name'
      ? 'Сортировка: по имени. Переключить на «по типу»'
      : 'Сортировка: по типу. Переключить на «по имени»';

  return (
    <div className="ws-tree-toolbar">
      <span
        className="ws-tree-toolbar__label"
        aria-live={isSearching ? 'polite' : undefined}
      >
        {isSearching
          ? `Найдено ${visibleCount} из ${totalCount} ${
              totalCount === 1 ? 'файла' : 'файлов'
            }`
          : 'Файлы'}
      </span>

      <div className="ws-tree-toolbar__actions">
        <ToolButton
          icon="sort"
          label={sortLabel}
          onClick={onToggleSort}
        />
        <ToolButton
          icon="density"
          label={compact ? 'Обычная плотность' : 'Компактная плотность'}
          onClick={onToggleDensity}
          pressed={compact}
        />
        <ToolButton
          icon="expandAll"
          label="Развернуть все папки"
          onClick={onExpandAll}
          disabled={!canExpandAll}
        />
        <ToolButton
          icon="collapseAll"
          label="Свернуть все папки"
          onClick={onCollapseAll}
          disabled={!canCollapseAll}
        />
      </div>
    </div>
  );
}
