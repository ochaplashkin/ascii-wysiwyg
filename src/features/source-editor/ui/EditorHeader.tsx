import type { LocalFile } from '../../workspace/model/directory-access.js';
import { DocumentMenu } from '../../editor/ui/DocumentMenu.js';
import type { EditorMode } from './ViewSwitch.js';
import { ViewSwitch } from './ViewSwitch.js';

export interface EditorHeaderProps {
  file: LocalFile;
  folderName: string;
  mode: EditorMode;
  hasDraft: boolean;
  /** PlantUML files have no visual mode, so the switch is hidden for them. */
  showModeSwitch?: boolean;
  onModeChange: (mode: EditorMode) => void;
  onReloadFromDisk: () => void;
  onResetDraft: () => void;
}

/** Breadcrumbs, draft badge, mode switch and the file menu. */
export function EditorHeader({
  file,
  folderName,
  mode,
  hasDraft,
  showModeSwitch = true,
  onModeChange,
  onReloadFromDisk,
  onResetDraft,
}: EditorHeaderProps) {
  const segments = file.path.split('/');

  return (
    <header className="se-header">
      <nav className="se-breadcrumb" aria-label="Путь к файлу">
        <span className="se-breadcrumb__folder" title={folderName}>
          {folderName}
        </span>
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="se-breadcrumb__part">
            <span className="se-breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span
              className={
                index === segments.length - 1
                  ? 'se-breadcrumb__file'
                  : 'se-breadcrumb__dir'
              }
              title={file.path}
            >
              {segment}
            </span>
          </span>
        ))}
      </nav>

      <div className="se-header__actions">
        {hasDraft ? (
          <span
            className="se-badge se-badge--draft"
            title="Есть несохранённые на диск изменения в браузере"
          >
            Черновик
          </span>
        ) : null}
        {showModeSwitch ? (
          <ViewSwitch mode={mode} onChange={onModeChange} />
        ) : null}
        <DocumentMenu
          hasDraft={hasDraft}
          onReloadFromDisk={onReloadFromDisk}
          onResetDraft={onResetDraft}
        />
      </div>
    </header>
  );
}
