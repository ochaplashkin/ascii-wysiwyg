import { Icon } from '../../../shared/ui/icons.js';
import type { TreeNode } from '../model/directory-tree.js';
import {
  canToggle,
  slotFor,
  type FileSelection,
} from '../model/file-selection.js';
import { FileRow } from './FileRow.js';

export interface FileTreeProps {
  nodes: readonly TreeNode[];
  depth?: number;
  activePath: string | null;
  selection: FileSelection;
  draftPaths: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  isSearching: boolean;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
  onToggleFile: (path: string) => void;
}

/** Accessible tree of files and directories (role=tree/treeitem/group). */
export function FileTree({
  nodes,
  depth = 0,
  activePath,
  selection,
  draftPaths,
  expanded,
  isSearching,
  onToggleDirectory,
  onOpenFile,
  onToggleFile,
}: FileTreeProps) {
  return (
    <ul className="ws-tree" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((node) => {
        if (node.type === 'directory') {
          const open = isSearching || expanded.has(node.path);

          return (
            <li
              key={node.path}
              role="treeitem"
              aria-expanded={open}
              aria-selected={false}
              className="ws-tree__item"
            >
              <button
                type="button"
                className="ws-tree__directory"
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() => onToggleDirectory(node.path)}
                title={node.path}
              >
                <span
                  className={`ws-tree__chevron${open ? ' is-open' : ''}`}
                  aria-hidden="true"
                >
                  <Icon name="chevronRight" size={12} />
                </span>
                <Icon name="folder" size={14} />
                <span className="ws-tree__directory-name">{node.name}</span>
              </button>

              {open ? (
                <FileTree
                  nodes={node.children}
                  depth={depth + 1}
                  activePath={activePath}
                  selection={selection}
                  draftPaths={draftPaths}
                  expanded={expanded}
                  isSearching={isSearching}
                  onToggleDirectory={onToggleDirectory}
                  onOpenFile={onOpenFile}
                  onToggleFile={onToggleFile}
                />
              ) : null}
            </li>
          );
        }

        const slot = slotFor(selection, node.path);

        return (
          <FileRow
            key={node.path}
            path={node.path}
            name={node.name}
            depth={depth}
            active={activePath === node.path}
            slot={slot}
            locked={!canToggle(selection, node.path)}
            hasDraft={draftPaths.has(node.path)}
            isSearching={isSearching}
            onOpen={onOpenFile}
            onToggle={onToggleFile}
          />
        );
      })}
    </ul>
  );
}
