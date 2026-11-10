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

const sortNodes = (nodes: TreeNode[]): void => {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }
    return collator.compare(left.name, right.name);
  });

  for (const node of nodes) {
    if (node.type === 'directory') sortNodes(node.children);
  }
};

/**
 * Turns a flat list of relative paths into a sorted directory tree.
 * Directories are listed before files, names are compared naturally
 * (`chapter2` goes before `chapter10`).
 */
export function buildFileTree(paths: Iterable<string>): TreeNode[] {
  const root: DirectoryNode = {
    type: 'directory',
    name: '',
    path: '',
    children: [],
  };
  const directories = new Map<string, DirectoryNode>([['', root]]);
  const seen = new Set<string>();

  for (const rawPath of paths) {
    const segments = rawPath.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    const fullPath = segments.join('/');
    if (seen.has(fullPath)) continue;
    seen.add(fullPath);

    let parent = root;
    const partial: string[] = [];

    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index];
      if (name === undefined) continue;
      partial.push(name);
      const path = partial.join('/');
      const isFile = index === segments.length - 1;

      if (isFile) {
        parent.children.push({ type: 'file', name, path });
        continue;
      }

      let directory = directories.get(path);
      if (!directory) {
        directory = { type: 'directory', name, path, children: [] };
        directories.set(path, directory);
        parent.children.push(directory);
      }
      parent = directory;
    }
  }

  sortNodes(root.children);
  return root.children;
}

/** Paths of every directory in the tree, useful for the initial expand. */
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

/** Keeps paths whose relative path contains the query (case-insensitive). */
export function filterPaths(
  paths: readonly string[],
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...paths];
  return paths.filter((path) => path.toLowerCase().includes(needle));
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
