import { Icon } from '../../../shared/ui/icons.js';
import { fileCountLabel } from '../model/directory-tree.js';
import type { LocalDirectory } from '../model/directory-access.js';

export interface FolderHeaderProps {
  directory: LocalDirectory | null;
  picking: boolean;
  onChoose: () => void;
}

/** App name plus the currently opened folder and its "change folder" action. */
export function FolderHeader({
  directory,
  picking,
  onChoose,
}: FolderHeaderProps) {
  return (
    <header className="ws-folder">
      <div className="ws-brand">
        <span className="ws-brand__mark" aria-hidden="true">
          A
        </span>
        <span className="ws-brand__text">
          <span className="ws-brand__title">AsciiDoc</span>
          <span className="ws-brand__subtitle">рабочая область</span>
        </span>
      </div>

      {directory ? (
        <div className="ws-folder__row">
          <span className="ws-folder__icon" aria-hidden="true">
            <Icon name="folder" size={16} />
          </span>
          <span className="ws-folder__name" title={directory.name}>
            {directory.name}
          </span>
          <span className="ws-folder__count">
            {fileCountLabel(directory.files.length)}
          </span>
        </div>
      ) : (
        <p className="ws-folder__empty-hint">
          Выберите папку с документами на локальном диске.
        </p>
      )}

      {directory ? (
        <button
          type="button"
          className="ws-button ws-button--ghost ws-folder__change"
          onClick={onChoose}
          disabled={picking}
        >
          <Icon name="folder" size={14} />
          {picking ? 'Открываем…' : 'Сменить папку'}
        </button>
      ) : null}
    </header>
  );
}
