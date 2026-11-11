import type { FileSlot } from '../model/file-selection.js';
import { FileTypeIcon } from './FileTypeIcon.js';
import { HighlightedText } from './HighlightedText.js';

export interface FileRowProps {
  path: string;
  name: string;
  active: boolean;
  slot: FileSlot | null;
  locked: boolean;
  hasDraft: boolean;
  query: string;
  onOpen: (path: string) => void;
  onToggle: (path: string) => void;
}

const SLOT_LABEL: Record<FileSlot, string> = {
  left: 'A',
  right: 'B',
};

/**
 * One file in the tree: a checkbox for comparison and a button to open it.
 * Neither control is in the Tab order: keyboard users drive the tree rows.
 */
export function FileRow({
  path,
  name,
  active,
  slot,
  locked,
  hasDraft,
  query,
  onOpen,
  onToggle,
}: FileRowProps) {
  const checkboxTitle = locked
    ? 'Сначала снимите один из выбранных файлов'
    : slot
      ? `Убрать «${name}» из сравнения`
      : `Отметить «${name}» для сравнения`;

  const label = query.trim().length > 0 ? path : name;

  return (
    <div
      className={[
        'ws-file',
        active ? 'is-active' : '',
        slot ? 'is-checked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label
        className={`ws-file__checkbox${locked ? ' is-locked' : ''}`}
        title={checkboxTitle}
      >
        <input
          type="checkbox"
          checked={slot !== null}
          disabled={locked}
          tabIndex={-1}
          onChange={() => onToggle(path)}
          aria-label={`${checkboxTitle}: ${path}`}
        />
      </label>

      <button
        type="button"
        className="ws-file__name"
        onClick={() => onOpen(path)}
        title={path}
        tabIndex={-1}
      >
        <FileTypeIcon name={name} />
        <span className="ws-file__label">
          <HighlightedText text={label} query={query} />
        </span>
      </button>

      {slot ? (
        <span
          className={`ws-file__slot ws-file__slot--${slot}`}
          title={slot === 'left' ? 'Файл A' : 'Файл B'}
          aria-label={slot === 'left' ? 'Файл A' : 'Файл B'}
        >
          {SLOT_LABEL[slot]}
        </span>
      ) : null}

      {hasDraft ? (
        <span
          className="ws-file__draft"
          title="Есть локальный черновик"
          aria-label="Есть локальный черновик"
        />
      ) : null}
    </div>
  );
}
