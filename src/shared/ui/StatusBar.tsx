import type { SaveStatus } from '../model/types.js';
import { SAVE_STATUS_LABEL } from '../model/types.js';

export interface StatusBarProps {
  lines?: number;
  words: number;
  characters: number;
  saveStatus: SaveStatus;
}

/** Bottom bar shared by the source and visual editors. */
export function StatusBar({
  lines,
  words,
  characters,
  saveStatus,
}: StatusBarProps) {
  return (
    <footer className="se-statusbar" aria-label="Состояние документа">
      {typeof lines === 'number' ? (
        <>
          <span className="se-statusbar__stat">
            Строк: <strong>{lines}</strong>
          </span>
          <span className="se-statusbar__dot" aria-hidden="true">
            ·
          </span>
        </>
      ) : null}
      <span className="se-statusbar__stat">
        Слов: <strong>{words}</strong>
      </span>
      <span className="se-statusbar__dot" aria-hidden="true">
        ·
      </span>
      <span className="se-statusbar__stat">
        Символов: <strong>{characters}</strong>
      </span>

      <span className="se-statusbar__spacer" />

      <span
        className={`se-statusbar__save is-${saveStatus}`}
        role="status"
        aria-live="polite"
      >
        {SAVE_STATUS_LABEL[saveStatus]}
      </span>

      <span
        className="se-statusbar__disk"
        title="Изменения сохраняются только в браузере. Исходный файл на диске не меняется."
      >
        Диск не меняется
      </span>

      <span className="se-badge">AsciiDoc</span>
    </footer>
  );
}
