/** File types that can be compared as AsciiDoc. */
export const SUPPORTED_EXTENSIONS = [
  '.adoc',
  '.asciidoc',
  '.asc',
  '.txt',
  '.md',
] as const;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/** Order of sibling nodes: `name` is natural, `type` groups by extension. */
export type SortMode = 'name' | 'type';

export interface FileNode {
  type: 'file';
  name: string;
  /** Path relative to the picked directory, using `/` separators. */
  path: string;
}

export interface DirectoryNode {
  type: 'directory';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | DirectoryNode;

export const isSupportedFile = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return false;
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(
    name.slice(dot).toLowerCase(),
  );
};

/** Lower-case extension without the dot, or `''` when there is none. */
const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
};

const compareNodes = (
  left: TreeNode,
  right: TreeNode,
  sortMode: SortMode,
): number => {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1;
  }

  if (sortMode === 'type' && left.type === 'file' && right.type === 'file') {
    const leftExtension = extensionOf(left.name);
    const rightExtension = extensionOf(right.name);

    if (leftExtension !== rightExtension) {
      // Files without an extension go last.
      if (leftExtension.length === 0) return 1;
      if (rightExtension.length === 0) return -1;
      return collator.compare(leftExtension, rightExtension);
    }
  }

  return collator.compare(left.name, right.name);
};

const sortTree = (nodes: TreeNode[], sortMode: SortMode): void => {
  nodes.sort((left, right) => compareNodes(left, right, sortMode));

  for (const node of nodes) {
    if (node.type === 'directory') sortTree(node.children, sortMode);
  }
};

const splitPath = (rawPath: string): string[] =>
  rawPath.split('/').filter(Boolean);

/**
 * Turns flat lists of relative file and directory paths into a sorted tree.
 * Directories are listed before files. The `name` mode compares names
 * naturally (`chapter2` goes before `chapter10`), the `type` mode groups files
 * by extension first.
 */
export function buildFileTree(
  files: Iterable<string>,
  directories: Iterable<string> = [],
  sortMode: SortMode = 'name',
): TreeNode[] {
  const root: DirectoryNode = {
    type: 'directory',
    name: '',
    path: '',
    children: [],
  };
  const directoryNodes = new Map<string, DirectoryNode>([['', root]]);

  const ensureDirectory = (segments: readonly string[]): DirectoryNode => {
    let parent = root;
    const partial: string[] = [];

    for (const name of segments) {
      partial.push(name);
      const path = partial.join('/');
      let node = directoryNodes.get(path);

      if (!node) {
        node = { type: 'directory', name, path, children: [] };
        directoryNodes.set(path, node);
        parent.children.push(node);
      }

      parent = node;
    }

    return parent;
  };

  // Directories first: an empty folder must exist even without files.
  for (const rawPath of directories) {
    const segments = splitPath(rawPath);
    if (segments.length === 0) continue;
    ensureDirectory(segments);
  }

  const seenFiles = new Set<string>();

  for (const rawPath of files) {
    const segments = splitPath(rawPath);
    if (segments.length === 0) continue;

    const fullPath = segments.join('/');
    if (seenFiles.has(fullPath)) continue;
    seenFiles.add(fullPath);

    const name = segments[segments.length - 1];
    if (name === undefined) continue;

    const parent = ensureDirectory(segments.slice(0, -1));
    parent.children.push({ type: 'file', name, path: fullPath });
  }

  sortTree(root.children, sortMode);
  return root.children;
}

/** Paths of every directory in the tree, useful for "expand all". */
export function collectDirectoryPaths(nodes: readonly TreeNode[]): string[] {
  const paths: string[] = [];

  const visit = (items: readonly TreeNode[]) => {
    for (const node of items) {
      if (node.type !== 'directory') continue;
      paths.push(node.path);
      visit(node.children);
    }
  };

  visit(nodes);
  return paths;
}

/** Number of files in the tree. */
export function countFiles(nodes: readonly TreeNode[]): number {
  let total = 0;

  for (const node of nodes) {
    if (node.type === 'file') total += 1;
    else total += countFiles(node.children);
  }

  return total;
}

/**
 * Paths of every directory above `path`, outermost first:
 * `ancestorPaths('a/b/c.adoc')` returns `['a', 'a/b']`.
 */
export function ancestorPaths(path: string): string[] {
  const segments = splitPath(path);
  const ancestors: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join('/'));
  }

  return ancestors;
}

/**
 * Keeps files whose path contains the query (case-insensitive) plus every
 * directory that either matches itself or still has a matching descendant.
 * A matched directory without matches inside is kept with empty children so
 * empty folders remain searchable.
 */
export function filterTree(
  nodes: readonly TreeNode[],
  query: string,
): TreeNode[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return nodes.slice();

  const visit = (items: readonly TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];

    for (const node of items) {
      const matches = node.path.toLowerCase().includes(needle);

      if (node.type === 'file') {
        if (matches) result.push(node);
        continue;
      }

      const children = visit(node.children);
      if (matches || children.length > 0) {
        result.push({ ...node, children });
      }
    }

    return result;
  };

  return visit(nodes);
}

/** Russian label for a file counter: 1 файл, 2 файла, 5 файлов. */
export function fileCountLabel(count: number): string {
  const absolute = Math.abs(count);
  const lastTwo = absolute % 100;
  const lastOne = absolute % 10;

  if (lastTwo > 10 && lastTwo < 20) return `${count} файлов`;
  if (lastOne === 1) return `${count} файл`;
  if (lastOne >= 2 && lastOne <= 4) return `${count} файла`;
  return `${count} файлов`;
}
