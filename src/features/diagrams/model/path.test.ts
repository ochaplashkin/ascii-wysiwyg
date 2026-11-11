import { describe, expect, it } from 'vitest';

import { dirnamePath, resolveDiagramPath } from './path.js';

describe('dirnamePath', () => {
  it('returns the directory part of a relative path', () => {
    expect(dirnamePath('docs/guide.adoc')).toBe('docs');
    expect(dirnamePath('docs/diagrams/flow.puml')).toBe('docs/diagrams');
  });

  it('returns an empty string for a top-level file', () => {
    expect(dirnamePath('guide.adoc')).toBe('');
  });
});

describe('resolveDiagramPath', () => {
  it('resolves a target relative to the document directory', () => {
    expect(resolveDiagramPath('docs', 'diagrams/flow.puml')).toBe(
      'docs/diagrams/flow.puml',
    );
  });

  it('normalizes `.` and `..` segments', () => {
    expect(resolveDiagramPath('docs/chapters', '../diagrams/flow.puml')).toBe(
      'docs/diagrams/flow.puml',
    );
    expect(resolveDiagramPath('docs', './a/./b.puml')).toBe('docs/a/b.puml');
  });

  it('rejects traversal above the picked folder', () => {
    expect(resolveDiagramPath('docs', '../../outside.puml')).toBeNull();
    expect(resolveDiagramPath('', '../outside.puml')).toBeNull();
  });

  it('rejects absolute and remote targets', () => {
    expect(resolveDiagramPath('docs', '/etc/passwd')).toBeNull();
    expect(resolveDiagramPath('docs', 'https://evil.example/a.puml')).toBeNull();
    expect(resolveDiagramPath('docs', 'C:/windows/a.puml')).toBeNull();
  });

  it('normalizes Windows separators', () => {
    expect(resolveDiagramPath('docs', '..\\diagrams\\flow.puml')).toBe(
      'diagrams/flow.puml',
    );
  });

  it('rejects empty targets', () => {
    expect(resolveDiagramPath('docs', '   ')).toBeNull();
    expect(resolveDiagramPath('docs', './')).toBeNull();
  });
});
