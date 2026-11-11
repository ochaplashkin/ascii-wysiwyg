// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { canPickDirectory, pickLocalDirectory } from './directory-access.js';

interface FakeFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
}

interface FakeDirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncIterable<FakeFileHandle | FakeDirectoryHandle>;
}

type FakeEntry = FakeFileHandle | FakeDirectoryHandle;

const fakeFile = (name: string, text: string): FakeFileHandle => ({
  kind: 'file',
  name,
  getFile: async () => ({ text: async () => text }) as unknown as File,
});

const fakeDirectory = (
  name: string,
  entries: FakeEntry[],
): FakeDirectoryHandle => ({
  kind: 'directory',
  name,
  values: async function* values() {
    yield* entries;
  },
});

const unreadableDirectory = (name: string): FakeDirectoryHandle => ({
  kind: 'directory',
  name,
  values: async function* values() {
    throw new Error('permission lost');
  },
});

const installPicker = (
  picker: (options?: { mode?: 'read' }) => Promise<FakeDirectoryHandle>,
) => {
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    writable: true,
    value: picker,
  });
};

const removePicker = () => {
  delete (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker;
};

afterEach(() => {
  removePicker();
});

describe('pickLocalDirectory', () => {
  it('walks nested folders and keeps only comparable text files', async () => {
    const intro = fakeFile('intro.adoc', '= Intro');
    const picker = vi.fn(async () =>
      fakeDirectory('docs', [
        intro,
        fakeDirectory('guide', [
          fakeFile('part.ADOC', '= Part'),
          fakeFile('cover.png', 'binary'),
        ]),
        fakeFile('notes.txt', 'notes'),
        fakeFile('README.md', '# readme'),
      ]),
    );
    installPicker(picker);

    const result = await pickLocalDirectory();

    expect(picker).toHaveBeenCalledWith({ mode: 'read' });
    expect(result).not.toBeNull();
    expect(result?.name).toBe('docs');
    expect(result?.truncated).toBe(false);
    expect(result?.files.map((file) => file.path)).toEqual([
      'intro.adoc',
      'guide/part.ADOC',
      'notes.txt',
      'README.md',
    ]);
    expect(result?.directories).toEqual(['guide']);
    expect(await result?.files[0]?.read()).toBe('= Intro');
  });

  it('skips hidden entries, dependency folders and unsupported files', async () => {
    installPicker(async () =>
      fakeDirectory('project', [
        fakeFile('.env.adoc', 'hidden'),
        fakeDirectory('.git', [fakeFile('config.adoc', 'git config')]),
        fakeDirectory('node_modules', [fakeFile('pkg.adoc', 'dep')]),
        fakeDirectory('vendor', [fakeFile('lib.adoc', 'vendor')]),
        fakeDirectory('content', [fakeFile('doc.adoc', 'ok')]),
        fakeFile('build.log', 'log'),
      ]),
    );

    const result = await pickLocalDirectory();

    expect(result?.files.map((file) => file.path)).toEqual(['content/doc.adoc']);
    expect(result?.directories).toEqual(['content']);
  });

  it('keeps sibling files when a subfolder cannot be read', async () => {
    installPicker(async () =>
      fakeDirectory('root', [
        fakeFile('first.adoc', 'first'),
        unreadableDirectory('broken'),
        fakeFile('last.adoc', 'last'),
      ]),
    );

    const result = await pickLocalDirectory();

    expect(result?.files.map((file) => file.path)).toEqual([
      'first.adoc',
      'last.adoc',
    ]);
    // The unreadable folder still belongs in the tree, it is just empty.
    expect(result?.directories).toEqual(['broken']);
  });

  it('collects empty folders and nested folders', async () => {
    installPicker(async () =>
      fakeDirectory('project', [
        fakeFile('guide.adoc', 'guide'),
        fakeDirectory('empty', []),
        fakeDirectory('docs', [
          fakeDirectory('nested-empty', []),
          fakeFile('intro.adoc', 'intro'),
        ]),
      ]),
    );

    const result = await pickLocalDirectory();

    expect(result?.files.map((file) => file.path)).toEqual([
      'guide.adoc',
      'docs/intro.adoc',
    ]);
    expect(result?.directories).toEqual(['empty', 'docs', 'docs/nested-empty']);
  });

  it('does not put hidden and skipped folders into directories', async () => {
    installPicker(async () =>
      fakeDirectory('project', [
        fakeDirectory('.git', [fakeFile('config.adoc', 'git')]),
        fakeDirectory('node_modules', []),
        fakeDirectory('bower_components', []),
        fakeDirectory('vendor', []),
        fakeDirectory('docs', []),
      ]),
    );

    const result = await pickLocalDirectory();

    expect(result?.directories).toEqual(['docs']);
  });

  it('returns truncated structure with the folders it managed to walk', async () => {
    const entries = [
      ...Array.from({ length: 1500 }, (_, index) =>
        fakeFile(`file-${index}.adoc`, ''),
      ),
      fakeDirectory('after-limit', []),
    ];
    installPicker(async () => fakeDirectory('many', entries));

    const result = await pickLocalDirectory();

    expect(result?.truncated).toBe(true);
    expect(result?.files).toHaveLength(1500);
    expect(result?.directories).toEqual([]);
  });

  it('returns null when the user cancels the dialog', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    installPicker(async () => {
      throw abort;
    });

    await expect(pickLocalDirectory()).resolves.toBeNull();
  });

  it('keeps the fallback input alive while the user picks a folder', async () => {
    vi.useFakeTimers();

    try {
      const pending = pickLocalDirectory();
      const input = document.querySelector<HTMLInputElement>(
        'input[webkitdirectory]',
      );
      if (!input) throw new Error('folder input was not created');

      // A browser dialog from a previous step can return the focus while the
      // folder input is still open. That must not cancel the selection.
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(5000);

      expect(document.querySelector('input[webkitdirectory]')).toBe(input);

      const file = new File(['= Late'], 'late.adoc');
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'docs/late.adoc',
      });
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      });
      input?.dispatchEvent(new Event('change'));

      await expect(pending).resolves.toEqual({
        name: 'docs',
        files: [
          expect.objectContaining({ path: 'late.adoc', name: 'late.adoc' }),
        ],
        directories: [],
        truncated: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when the fallback folder dialog is dismissed', async () => {
    const pending = pickLocalDirectory();
    const input = document.querySelector<HTMLInputElement>(
      'input[webkitdirectory]',
    );

    input?.dispatchEvent(new Event('cancel'));

    await expect(pending).resolves.toBeNull();
  });

  it('stops after the file limit and marks the result as truncated', async () => {
    const entries = Array.from({ length: 1600 }, (_, index) =>
      fakeFile(`file-${index}.adoc`, ''),
    );
    installPicker(async () => fakeDirectory('many', entries));

    const result = await pickLocalDirectory();

    expect(result?.files).toHaveLength(1500);
    expect(result?.truncated).toBe(true);
  });
});

describe('canPickDirectory', () => {
  it('reports the File System Access API when it is available', () => {
    expect(canPickDirectory()).toBe(false);
    installPicker(async () => fakeDirectory('docs', []));
    expect(canPickDirectory()).toBe(true);
  });
});
