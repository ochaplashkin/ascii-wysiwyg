import type { DocumentStats, SaveStatus } from '../editor/types.js';
import { getSaveStatusLabel } from '../model/document.js';

export interface StatusBarProps {
  stats: DocumentStats;
  saveStatus: SaveStatus;
}

export function StatusBar({ stats, saveStatus }: StatusBarProps) {
  return (
    <footer className="editor-statusbar" aria-label="Состояние документа">
      <span className="editor-statusbar__stat">
        Слов: <strong>{stats.words}</strong>
      </span>
      <span className="editor-statusbar__dot" aria-hidden="true">
        ·
      </span>
      <span className="editor-statusbar__stat">
        Символов: <strong>{stats.characters}</strong>
      </span>
      <span className="editor-statusbar__spacer" />
      <span
        className={`editor-statusbar__save is-${saveStatus}`}
        role="status"
        aria-live="polite"
      >
        {getSaveStatusLabel(saveStatus)}
      </span>
      <span className="editor-badge">AsciiDoc</span>
    </footer>
  );
}
