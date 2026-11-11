import type { FileSlot } from '../model/file-selection.js';

export interface FileRowProps {
  path: string;
  name: string;
  depth: number;
  active: boolean;
  slot: FileSlot | null;
  locked: boolean;
  hasDraft: boolean;
  isSearching: boolean;
  onOpen: (path: string) => void;
  onToggle: (path: string) => void;
}

const SLOT_LABEL: Record<FileSlot, string> = {
  left: 'A',
  right: 'B',
};

/** One file in the tree: a checkbox for comparison and a button to open it. */
export function FileRow({
  path,
  name,
  depth,
  active,
  slot,
  locked,
  hasDraft,
  isSearching,
  onOpen,
  onToggle,
}: FileRowProps) {
  const checkboxTitle = locked
    ? 'Сначала снимите один из выбранных файлов'
    : slot
      ? `Убрать «${name}» из сравнения`
      : `Отметить «${name}» для сравнения`;

  return (
    <li
      role="treeitem"
      aria-selected={active}
      className="ws-tree__item ws-tree__item--file"
    >
      <div
        className={[
          'ws-file',
          active ? 'is-active' : '',
          slot ? 'is-checked' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <label
          className={`ws-file__checkbox${locked ? ' is-locked' : ''}`}
          title={checkboxTitle}
        >
          <input
            type="checkbox"
            checked={slot !== null}
            disabled={locked}
            onChange={() => onToggle(path)}
            aria-label={`${checkboxTitle}: ${path}`}
          />
        </label>

        <button
          type="button"
          className="ws-file__name"
          onClick={() => onOpen(path)}
          title={path}
          aria-current={active ? 'true' : undefined}
        >
          <span className="ws-file__icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M14 3v5h5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="ws-file__label">
            {isSearching ? path : name}
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
    </li>
  );
}
