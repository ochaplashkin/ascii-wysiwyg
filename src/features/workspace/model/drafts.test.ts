import { describe, expect, it } from 'vitest';

import {
  DRAFT_PREFIX,
  draftKey,
  hashText,
  listDraftPaths,
  loadDraft,
  removeDraft,
  saveDraft,
  type DraftListStorage,
} from './drafts.js';

class FakeStorage implements DraftListStorage {
  private readonly data = new Map<string, string>();

  failNextWrite = false;

  get length(): number {
    return this.data.size;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('QuotaExceededError');
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

describe('hashText', () => {
  it('is stable and distinguishes different texts', () => {
    expect(hashText('= Doc')).toBe(hashText('= Doc'));
    expect(hashText('= Doc')).not.toBe(hashText('= Doc '));
    expect(hashText('')).toContain('-0');
  });
});

describe('draftKey', () => {
  it('includes the version, folder and relative path', () => {
    expect(draftKey('docs', 'guide/part.adoc')).toBe(
      `${DRAFT_PREFIX}:docs:guide/part.adoc`,
    );
  });
});

describe('saveDraft and loadDraft', () => {
  it('round-trips a draft record', () => {
    const storage = new FakeStorage();
    const record = saveDraft('docs', 'a.adoc', '= A', 'hash', storage, '2026-01-01');

    expect(record).toMatchObject({
      version: 2,
      text: '= A',
      baseHash: 'hash',
      savedAt: '2026-01-01',
    });
    expect(loadDraft('docs', 'a.adoc', storage)).toEqual(record);
  });

  it('keeps drafts of different files apart', () => {
    const storage = new FakeStorage();
    saveDraft('docs', 'a.adoc', 'a', 'hash', storage);
    saveDraft('docs', 'b.adoc', 'b', 'hash', storage);

    expect(loadDraft('docs', 'a.adoc', storage)?.text).toBe('a');
    expect(loadDraft('docs', 'b.adoc', storage)?.text).toBe('b');
  });

  it('returns null on quota errors and keeps the previous draft', () => {
    const storage = new FakeStorage();
    saveDraft('docs', 'a.adoc', 'old', 'hash', storage);

    storage.failNextWrite = true;
    expect(saveDraft('docs', 'a.adoc', 'new', 'hash', storage)).toBeNull();
    expect(loadDraft('docs', 'a.adoc', storage)?.text).toBe('old');
  });

  it('ignores malformed records', () => {
    const storage = new FakeStorage();
    storage.setItem(draftKey('docs', 'a.adoc'), '{"version":2}');

    expect(loadDraft('docs', 'a.adoc', storage)).toBeNull();
  });
});

describe('removeDraft', () => {
  it('deletes only the requested draft', () => {
    const storage = new FakeStorage();
    saveDraft('docs', 'a.adoc', 'a', 'hash', storage);
    saveDraft('docs', 'b.adoc', 'b', 'hash', storage);

    removeDraft('docs', 'a.adoc', storage);

    expect(loadDraft('docs', 'a.adoc', storage)).toBeNull();
    expect(loadDraft('docs', 'b.adoc', storage)?.text).toBe('b');
  });
});

describe('listDraftPaths', () => {
  it('lists only drafts of the requested folder', () => {
    const storage = new FakeStorage();
    saveDraft('docs', 'a.adoc', 'a', 'hash', storage);
    saveDraft('docs', 'guide/b.adoc', 'b', 'hash', storage);
    saveDraft('other', 'c.adoc', 'c', 'hash', storage);

    expect(listDraftPaths('docs', storage).sort()).toEqual([
      'a.adoc',
      'guide/b.adoc',
    ]);
  });
});
