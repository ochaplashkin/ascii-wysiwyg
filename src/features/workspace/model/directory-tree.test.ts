import { describe, expect, it } from 'vitest';

import {
  buildFileTree,
  collectDirectoryPaths,
  fileCountLabel,
  filterPaths,
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

describe('filterPaths', () => {
  const paths = ['docs/intro.adoc', 'docs/Chapter-2.adoc', 'notes.txt'];

  it('matches a case-insensitive substring of the relative path', () => {
    expect(filterPaths(paths, 'chapter')).toEqual(['docs/Chapter-2.adoc']);
    expect(filterPaths(paths, 'DOCS/')).toEqual([
      'docs/intro.adoc',
      'docs/Chapter-2.adoc',
    ]);
  });

  it('trims the query and returns all paths for an empty one', () => {
    expect(filterPaths(paths, '  intro ')).toEqual(['docs/intro.adoc']);
    expect(filterPaths(paths, '   ')).toEqual(paths);
  });

  it('returns a new array for an empty query', () => {
    const result = filterPaths(paths, '');
    expect(result).toEqual(paths);
    expect(result).not.toBe(paths);
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
