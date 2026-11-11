import { Icon } from '../../../shared/ui/icons.js';
import { HighlightedText } from './HighlightedText.js';

export interface FolderRowProps {
  path: string;
  name: string;
  open: boolean;
  query: string;
  onToggle: (path: string) => void;
}

/**
 * One directory row: chevron, folder icon and the (possibly highlighted)
 * name. The row is not focusable itself; the surrounding `treeitem` owns the
 * roving tabindex.
 */
export function FolderRow({
  path,
  name,
  open,
  query,
  onToggle,
}: FolderRowProps) {
  return (
    <button
      type="button"
      className="ws-tree__directory"
      onClick={() => onToggle(path)}
      title={path}
      tabIndex={-1}
    >
      <span
        className={`ws-tree__chevron${open ? ' is-open' : ''}`}
        aria-hidden="true"
      >
        <Icon name="chevronRight" size={12} />
      </span>
      <span
        className={`ws-tree__folder-icon${open ? ' is-open' : ''}`}
        aria-hidden="true"
      >
        <Icon name={open ? 'folderOpen' : 'folder'} size={14} />
      </span>
      <span className="ws-tree__directory-name">
        <HighlightedText text={name} query={query} />
      </span>
    </button>
  );
}
