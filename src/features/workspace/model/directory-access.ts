import { isEditableFile } from './directory-tree.js';

/** A text file the sidebar can read on demand. */
export interface LocalFile {
  /** Path relative to the picked directory, with `/` separators. */
  path: string;
  name: string;
  read: () => Promise<string>;
}

export interface LocalDirectory {
  name: string;
  files: LocalFile[];
  /**
   * Paths of every walked directory, including empty ones. The legacy
   * `<input webkitdirectory>` fallback cannot see empty folders and returns
   * an empty list.
   */
  directories: string[];
  /** True when the directory holds more files than the walk collected. */
  truncated: boolean;
}

/**
 * Minimal structural types for the File System Access API. The DOM typings
 * shipped with TypeScript do not include `showDirectoryPicker`, and using the
 * browser interfaces directly would make the feature untestable elsewhere.
 */
interface ReadableFileHandle {
  kind?: 'file';
  name: string;
  getFile: () => Promise<File>;
  queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
}

interface ReadableDirectoryHandle {
  kind?: 'directory';
  name: string;
  values: () => AsyncIterable<ReadableFileHandle | ReadableDirectoryHandle>;
}

type DirectoryPicker = (options?: {
  mode?: 'read';
}) => Promise<ReadableDirectoryHandle>;

const MAX_FILES = 1500;
const MAX_DEPTH = 8;
const SKIP_DIRECTORIES = new Set(['node_modules', 'bower_components', 'vendor']);
const INPUT_CANCEL_DELAY = 600;

/** True for pages opened inside another page (preview frames, embeds). */
const isEmbeddedFrame = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent makes `window.top` unreadable.
    return true;
  }
};

const getDirectoryPicker = (): DirectoryPicker | null => {
  if (typeof window === 'undefined') return null;

  const picker = (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker;
  if (typeof picker !== 'function') return null;

  return (picker as DirectoryPicker).bind(window);
};

const namedError = (reason: unknown): string =>
  typeof reason === 'object' &&
  reason !== null &&
  'name' in reason &&
  typeof (reason as { name: unknown }).name === 'string'
    ? (reason as { name: string }).name
    : '';

const isDirectoryEntry = (
  entry: ReadableFileHandle | ReadableDirectoryHandle,
): entry is ReadableDirectoryHandle => entry.kind === 'directory';

const ensureReadPermission = async (
  handle: ReadableFileHandle,
): Promise<void> => {
  if (!handle.queryPermission) return;

  let permission: PermissionState = 'granted';
  try {
    permission = await handle.queryPermission({ mode: 'read' });
  } catch {
    // Some embedded contexts reject queryPermission; getFile below reports
    // the actual problem.
    return;
  }

  if (permission === 'granted') return;

  const requested = handle.requestPermission
    ? await handle.requestPermission({ mode: 'read' })
    : permission;

  if (requested !== 'granted') {
    throw new Error(
      `Браузер не дал доступ к файлу «${handle.name}». Выберите папку заново.`,
    );
  }
};

const readHandleText = async (handle: ReadableFileHandle): Promise<string> => {
  await ensureReadPermission(handle);
  const file = await handle.getFile();
  return file.text();
};

interface WalkState {
  files: LocalFile[];
  directories: string[];
  truncated: boolean;
}

const collectFiles = async (
  handle: ReadableDirectoryHandle,
  prefix: string,
  depth: number,
  state: WalkState,
): Promise<void> => {
  if (state.files.length >= MAX_FILES) {
    state.truncated = true;
    return;
  }

  let entries: AsyncIterable<ReadableFileHandle | ReadableDirectoryHandle>;
  try {
    entries = handle.values();
  } catch {
    return;
  }

  try {
    for await (const entry of entries) {
      if (state.files.length >= MAX_FILES) {
        state.truncated = true;
        return;
      }

      if (!entry || typeof entry.name !== 'string') continue;
      if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const path = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (isDirectoryEntry(entry)) {
        if (depth < MAX_DEPTH) {
          // Record the folder before walking it: an unreadable folder still
          // belongs in the tree, it is just shown empty.
          state.directories.push(path);
          await collectFiles(entry, path, depth + 1, state);
        }
      } else if (isEditableFile(entry.name)) {
        state.files.push({
          path,
          name: entry.name,
          read: () => readHandleText(entry),
        });
      }
    }
  } catch {
    // A sub-directory may become unreadable while walking; keep the rest.
  }
};

/**
 * Legacy fallback for browsers without the File System Access API: a hidden
 * `<input type="file" webkitdirectory>` opens the system folder dialog.
 */
const pickDirectoryWithInput = (): Promise<LocalDirectory | null> => {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');

    // Modern browsers fire `cancel` on the input when the dialog is
    // dismissed. The window-focus heuristic below is only a fallback for
    // older engines: it must never remove the input while the user is still
    // browsing, otherwise a late "Upload" click is silently ignored.
    const supportsCancelEvent = 'oncancel' in input;

    let settled = false;
    let focusTimer: number | undefined;

    const onWindowFocus = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);

      focusTimer = window.setTimeout(() => {
        focusTimer = undefined;
        if (settled || (input.files?.length ?? 0) > 0) return;
        // Another native dialog may still own the focus (for example when
        // this input is the fallback for a blocked directory picker).
        if (!document.hasFocus()) return;
        finish(null);
      }, INPUT_CANCEL_DELAY);
    };

    const cleanup = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      window.removeEventListener('focus', onWindowFocus);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
    };

    const finish = (value: LocalDirectory | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onChange = () => {
      const files: LocalFile[] = [];
      const selected = Array.from(input.files ?? []);
      let rootName = 'Папка';

      for (const file of selected) {
        if (files.length >= MAX_FILES) break;

        const relative =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const segments = relative.split('/').filter(Boolean);

        if (segments.length > 1) {
          rootName = segments[0] ?? rootName;
          segments.shift();
        }

        const path = segments.join('/');
        if (path.length === 0 || !isEditableFile(path)) continue;

        files.push({ path, name: file.name, read: () => file.text() });
      }

      finish({
        name: rootName,
        files,
        // `<input webkitdirectory>` only reports files, so empty folders are
        // invisible in this fallback.
        directories: [],
        truncated: selected.length > MAX_FILES,
      });
    };

    const onCancel = () => finish(null);

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    if (!supportsCancelEvent) {
      window.addEventListener('focus', onWindowFocus);
    }
    document.body.append(input);
    input.click();
  });
};

const isDirectoryPickerSupported = (): boolean => getDirectoryPicker() !== null;

/**
 * Asks the user for a directory and returns all comparable text files inside
 * it. Resolves to `null` when the dialog is cancelled.
 */
export async function pickLocalDirectory(): Promise<LocalDirectory | null> {
  const picker = getDirectoryPicker();
  // `showDirectoryPicker` is rejected in cross-origin frames, so go straight
  // to the input fallback there instead of opening a dialog that cannot be
  // completed.
  if (!picker || isEmbeddedFrame()) return pickDirectoryWithInput();

  let root: ReadableDirectoryHandle;
  try {
    root = await picker({ mode: 'read' });
  } catch (reason) {
    const name = namedError(reason);
    if (name === 'AbortError') return null;
    if (name === 'SecurityError' || name === 'NotSupportedError') {
      return pickDirectoryWithInput();
    }
    throw reason;
  }

  const state: WalkState = { files: [], directories: [], truncated: false };
  await collectFiles(root, '', 0, state);

  return {
    name: root.name || 'Папка',
    files: state.files,
    directories: state.directories,
    truncated: state.truncated,
  };
}

export const canPickDirectory = (): boolean =>
  isDirectoryPickerSupported() ||
  (typeof document !== 'undefined' &&
    'webkitdirectory' in document.createElement('input'));
