import { describe, expect, it } from 'vitest';

import {
  ancestorPaths,
  buildFileTree,
  collectDirectoryPaths,
  countFiles,
  fileCountLabel,
  filterTree,
  isEditableFile,
  isSupportedFile,
  type DirectoryNode,
  type TreeNode,
} from './directory-tree.js';

const filePaths = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) =>
    node.type === 'file' ? [node.path] : filePaths(node.children),
  );

const directory = (nodes: readonly TreeNode[], name: string): DirectoryNode => {
  const node = nodes.find(
    (candidate) => candidate.type === 'directory' && candidate.name === name,
  );
  if (!node || node.type !== 'directory') {
    throw new Error(`directory ${name} not found`);
  }
  return node;
};

describe('isSupportedFile', () => {
  it('accepts AsciiDoc-like text files regardless of case', () => {
    expect(isSupportedFile('guide.adoc')).toBe(true);
    expect(isSupportedFile('GUIDE.ADOC')).toBe(true);
    expect(isSupportedFile('spec.asciidoc')).toBe(true);
    expect(isSupportedFile('notes.txt')).toBe(true);
    expect(isSupportedFile('README.md')).toBe(true);
  });

  it('rejects binaries and names without a proper extension', () => {
    expect(isSupportedFile('photo.png')).toBe(false);
    expect(isSupportedFile('archive.adoc.zip')).toBe(false);
    expect(isSupportedFile('adoc')).toBe(false);
    expect(isSupportedFile('.adoc')).toBe(false);
    expect(isSupportedFile('notes.')).toBe(false);
  });
});

describe('isEditableFile', () => {
  it('accepts AsciiDoc documents and PlantUML sources', () => {
    expect(isEditableFile('guide.adoc')).toBe(true);
    expect(isEditableFile('notes.txt')).toBe(true);
    expect(isEditableFile('flow.puml')).toBe(true);
    expect(isEditableFile('FLOW.PLANTUML')).toBe(true);
  });

  it('keeps PlantUML out of the comparable documents', () => {
    expect(isSupportedFile('flow.puml')).toBe(false);
    expect(isEditableFile('photo.png')).toBe(false);
  });
});

describe('buildFileTree', () => {
  it('nests files and puts directories before files', () => {
    const tree = buildFileTree([
      'b.adoc',
      'a/intro.adoc',
      'a/deep/part.adoc',
      'c.txt',
    ]);

    expect(tree.map((node) => node.name)).toEqual(['a', 'b.adoc', 'c.txt']);
    expect(directory(tree, 'a').children.map((node) => node.name)).toEqual([
      'deep',
      'intro.adoc',
    ]);
    expect(filePaths(tree)).toEqual([
      'a/deep/part.adoc',
      'a/intro.adoc',
      'b.adoc',
      'c.txt',
    ]);
  });

  it('sorts numbered names naturally', () => {
    expect(
      filePaths(
        buildFileTree(['chapter10.adoc', 'chapter2.adoc', 'chapter1.adoc']),
      ),
    ).toEqual(['chapter1.adoc', 'chapter2.adoc', 'chapter10.adoc']);
  });

  it('ignores duplicates and empty paths', () => {
    const tree = buildFileTree(['a.adoc', 'a.adoc', '', '/', 'dir/x.adoc']);

    expect(filePaths(tree)).toEqual(['dir/x.adoc', 'a.adoc']);
    expect(collectDirectoryPaths(tree)).toEqual(['dir']);
  });

  it('creates missing parent directories for nested paths', () => {
    const tree = buildFileTree(['one/two/three.adoc']);

    expect(collectDirectoryPaths(tree)).toEqual(['one', 'one/two']);
    expect(filePaths(tree)).toEqual(['one/two/three.adoc']);
  });

  it('keeps empty directories and nested empty directories', () => {
    const tree = buildFileTree(
      ['docs/intro.adoc'],
      ['docs/empty', 'docs/empty/deep', 'assets', 'docs/empty'],
    );

    expect(tree.map((node) => node.name)).toEqual(['assets', 'docs']);
    expect(directory(tree, 'docs').children.map((node) => node.name)).toEqual([
      'empty',
      'intro.adoc',
    ]);
    expect(
      directory(directory(tree, 'docs').children, 'empty').children.map(
        (node) => node.name,
      ),
    ).toEqual(['deep']);
    expect(countFiles(tree)).toBe(1);
  });

  it('sorts by type: directories first, files by extension, then name', () => {
    const tree = buildFileTree(
      [
        'z.md',
        'b.txt',
        'a.adoc',
        'no-extension',
        'dir1/x.adoc',
        'dir2/y.adoc',
      ],
      [],
      'type',
    );

    expect(tree.map((node) => node.name)).toEqual([
      'dir1',
      'dir2',
      'a.adoc',
      'z.md',
      'b.txt',
      'no-extension',
    ]);
  });

  it('sorts files with equal extensions naturally in type mode', () => {
    const tree = buildFileTree(
      ['chapter10.adoc', 'chapter2.adoc', 'b.md'],
      [],
      'type',
    );

    expect(tree.map((node) => node.name)).toEqual([
      'chapter2.adoc',
      'chapter10.adoc',
      'b.md',
    ]);
  });
});

describe('collectDirectoryPaths', () => {
  it('returns every directory path in tree order', () => {
    const tree = buildFileTree([
      'docs/guide/intro.adoc',
      'docs/guide/deep/part.adoc',
      'docs/api.adoc',
    ]);

    expect(collectDirectoryPaths(tree)).toEqual([
      'docs',
      'docs/guide',
      'docs/guide/deep',
    ]);
  });
});

describe('countFiles', () => {
  it('counts files on every level', () => {
    expect(countFiles(buildFileTree(['a.adoc', 'd/b.adoc', 'd/e/c.adoc']))).toBe(
      3,
    );
    expect(countFiles(buildFileTree([], ['empty']))).toBe(0);
  });
});

describe('ancestorPaths', () => {
  it('returns the directories above a file, outermost first', () => {
    expect(ancestorPaths('a/b/c.adoc')).toEqual(['a', 'a/b']);
    expect(ancestorPaths('root.adoc')).toEqual([]);
    expect(ancestorPaths('/leading/slash.adoc')).toEqual(['leading']);
  });
});

describe('filterTree', () => {
  const tree = buildFileTree(
    ['docs/intro.adoc', 'docs/Chapter-2.adoc', 'notes.txt', 'other/readme.md'],
    ['docs/empty', 'assets/images'],
  );

  it('matches a case-insensitive substring of the relative path', () => {
    const filtered = filterTree(tree, 'chapter');

    expect(filePaths(filtered)).toEqual(['docs/Chapter-2.adoc']);
    expect(filtered.map((node) => node.name)).toEqual(['docs']);
    expect(
      directory(filtered, 'docs').children.map((node) => node.name),
    ).toEqual(['Chapter-2.adoc']);
  });

  it('keeps the ancestors of a match', () => {
    const filtered = filterTree(tree, 'readme');

    expect(filtered.map((node) => node.name)).toEqual(['other']);
    expect(filePaths(filtered)).toEqual(['other/readme.md']);
  });

  it('keeps a matched empty directory with empty children', () => {
    const filtered = filterTree(tree, 'empty');
    const docs = directory(filtered, 'docs');

    expect(docs.children).toEqual([
      expect.objectContaining({ type: 'directory', path: 'docs/empty' }),
    ]);
    expect(directory(docs.children, 'empty').children).toEqual([]);
  });

  it('returns the whole tree for an empty query', () => {
    const result = filterTree(tree, '   ');

    expect(result).toEqual(tree);
    expect(result).not.toBe(tree);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterTree(tree, 'zzz')).toEqual([]);
  });
});

describe('fileCountLabel', () => {
  it('declines the Russian noun correctly', () => {
    expect(fileCountLabel(0)).toBe('0 файлов');
    expect(fileCountLabel(1)).toBe('1 файл');
    expect(fileCountLabel(2)).toBe('2 файла');
    expect(fileCountLabel(5)).toBe('5 файлов');
    expect(fileCountLabel(11)).toBe('11 файлов');
    expect(fileCountLabel(21)).toBe('21 файл');
    expect(fileCountLabel(22)).toBe('22 файла');
    expect(fileCountLabel(101)).toBe('101 файл');
  });
});
