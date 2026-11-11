import { Icon } from '../../../shared/ui/icons.js';
import { EDITABLE_EXTENSIONS } from '../model/directory-tree.js';

export interface EmptyWorkspaceProps {
  hasDirectory: boolean;
  picking: boolean;
  pickerAvailable: boolean;
  onPick: () => void;
}

/** Start screen: either pick a folder or pick a file from the sidebar. */
export function EmptyWorkspace({
  hasDirectory,
  picking,
  pickerAvailable,
  onPick,
}: EmptyWorkspaceProps) {
  if (hasDirectory) {
    return (
      <section className="ws-empty" aria-labelledby="ws-empty-title">
        <div className="ws-empty__card">
          <span className="ws-empty__icon" aria-hidden="true">
            <Icon name="file" size={26} />
          </span>
          <h1 id="ws-empty-title" className="ws-empty__title">
            Выберите файл
          </h1>
          <p className="ws-empty__text">
            Кликните по документу в панели слева, чтобы открыть его в
            редакторе. Отметьте два файла чекбоксами и нажмите «Сравнить»,
            чтобы увидеть различия.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="ws-empty" aria-labelledby="ws-empty-title">
      <div className="ws-empty__card">
        <span className="ws-empty__icon" aria-hidden="true">
          <Icon name="folder" size={26} />
        </span>
        <h1 id="ws-empty-title" className="ws-empty__title">
          Выберите папку, чтобы начать
        </h1>
        <p className="ws-empty__text">
          Приложение читает файлы прямо с вашего диска. Изменения сохраняются
          только в браузере, исходные файлы не меняются.
        </p>

        <button
          type="button"
          className="ws-button ws-button--primary ws-button--large"
          onClick={onPick}
          disabled={picking || !pickerAvailable}
        >
          {picking ? (
            <span className="ws-spinner" aria-hidden="true" />
          ) : (
            <Icon name="folder" size={16} />
          )}
          <span>{picking ? 'Открываем…' : 'Выбрать папку'}</span>
        </button>

        <p className="ws-empty__meta">
          Поддерживаются {EDITABLE_EXTENSIONS.join(', ')}.
        </p>

        {!pickerAvailable ? (
          <p className="ws-note ws-note--warning">
            Браузер не поддерживает выбор папки. Откройте приложение в
            актуальной версии Chrome, Edge, Firefox или Safari.
          </p>
        ) : null}
      </div>
    </section>
  );
}
