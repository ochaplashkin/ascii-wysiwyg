import { Icon } from '../../../shared/ui/icons.js';
import type { LocalFile } from '../model/directory-access.js';
import {
  clearSlot,
  isComplete,
  type FileSelection,
  type FileSlot,
} from '../model/file-selection.js';

export interface CompareSlotsProps {
  selection: FileSelection;
  files: ReadonlyMap<string, LocalFile>;
  comparing: boolean;
  onClear: (slot: FileSlot) => void;
  onSwap: () => void;
  onCompare: () => void;
}

const SLOTS: readonly FileSlot[] = ['left', 'right'];
const SLOT_LABEL: Record<FileSlot, string> = { left: 'A', right: 'B' };
const SLOT_NAME: Record<FileSlot, string> = {
  left: 'файл A',
  right: 'файл B',
};

/** A/B slots and the primary "Сравнить" action. */
export function CompareSlots({
  selection,
  files,
  comparing,
  onClear,
  onSwap,
  onCompare,
}: CompareSlotsProps) {
  const complete = isComplete(selection);
  const hasAny = selection.left !== null || selection.right !== null;

  return (
    <div className="ws-compare">
      <div className="ws-compare__slots">
        {SLOTS.map((slot) => {
          const path = selection[slot];
          const file = path ? files.get(path) : undefined;

          return (
            <div
              key={slot}
              className={`ws-slot ws-slot--${slot}`}
              data-filled={file ? 'true' : undefined}
            >
              <span className={`ws-slot__tag ws-slot__tag--${slot}`}>
                {SLOT_LABEL[slot]}
              </span>
              <span
                className={`ws-slot__text${file ? '' : ' is-empty'}`}
                title={path ?? `Не выбран (${SLOT_NAME[slot]})`}
              >
                {file ? file.name : `Не выбран (${SLOT_NAME[slot]})`}
              </span>
              {file ? (
                <button
                  type="button"
                  className="ws-slot__clear"
                  onClick={() => onClear(slot)}
                  aria-label={`Убрать ${SLOT_NAME[slot]} из сравнения`}
                  title="Убрать"
                >
                  <Icon name="close" size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="ws-compare__actions">
        <button
          type="button"
          className="ws-button ws-button--icon"
          onClick={onSwap}
          disabled={!hasAny}
          aria-label="Поменять файлы местами"
          title="Поменять файлы местами"
        >
          <Icon name="merge" size={15} />
        </button>

        <button
          type="button"
          className="ws-button ws-button--primary ws-compare__run"
          onClick={onCompare}
          disabled={!complete || comparing}
          title={
            complete
              ? 'Сравнить выбранные файлы'
              : 'Отметьте два файла, чтобы сравнить'
          }
        >
          {comparing ? (
            <span className="ws-spinner" aria-hidden="true" />
          ) : (
            <Icon name="split" size={15} />
          )}
          <span>{comparing ? 'Читаем файлы…' : 'Сравнить'}</span>
        </button>
      </div>

      <p className="ws-compare__hint">
        {complete
          ? 'Два файла отмечены — можно сравнить.'
          : 'Чекбоксы отмечают файлы для сравнения. Клик по имени открывает файл.'}
      </p>
    </div>
  );
}
