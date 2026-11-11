import { useCallback, useEffect, useRef, useState } from 'react';

import type { SaveStatus } from '../../../shared/model/types.js';
import type { LocalFile } from './directory-access.js';
import {
  hashText,
  loadDraft,
  removeDraft,
  saveDraft,
  type DraftRecord,
} from './drafts.js';

const AUTOSAVE_DELAY = 500;

export interface DocumentSession {
  path: string;
  folderName: string;
  /** Text read from disk; never modified by the app. */
  diskText: string;
  /** Current editor text (canonical source of truth for the view). */
  source: string;
  /** Last value written to localStorage. */
  savedSource: string;
  hasDraft: boolean;
  draftSavedAt: string | null;
  draftBaseHash: string | null;
  status: SaveStatus;
  /** A draft created from a different disk revision than the current one. */
  conflict: DraftRecord | null;
}

export interface DocumentSessionActions {
  setSource: (next: string) => void;
  saveNow: () => void;
  /** Throw the draft away and show the on-disk text. */
  resetDraft: () => void;
  /** Re-reads the file; returns the fresh disk text. */
  reloadFromDisk: () => Promise<string>;
  /** Replace the buffer with the given disk text and delete the draft. */
  useDiskVersion: (diskText: string) => void;
  /** Keep the current text but treat `diskText` as the new baseline. */
  keepDraftAsBaseline: (diskText: string) => void;
  resolveConflict: (choice: 'disk' | 'draft') => void;
  /** Retry loading after a read error. */
  retry: () => void;
}

export interface DocumentSessionState {
  session: DocumentSession | null;
  loading: boolean;
  error: string | null;
  actions: DocumentSessionActions;
}

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

const createSession = (
  folderName: string,
  path: string,
  diskText: string,
  draft: DraftRecord | null,
): DocumentSession => {
  const diskHash = hashText(diskText);
  const base = {
    path,
    folderName,
    diskText,
    source: diskText,
    savedSource: diskText,
    hasDraft: false,
    draftSavedAt: null,
    draftBaseHash: null,
    status: 'saved' as const,
    conflict: null,
  } satisfies DocumentSession;

  if (!draft) return base;

  if (draft.baseHash !== diskHash) {
    // The file changed on disk since the draft was created. Show the disk
    // version and let the user choose instead of silently discarding either.
    return {
      ...base,
      hasDraft: true,
      draftSavedAt: draft.savedAt,
      draftBaseHash: draft.baseHash,
      conflict: draft,
    };
  }

  if (draft.text === diskText) {
    removeDraft(folderName, path);
    return base;
  }

  return {
    ...base,
    source: draft.text,
    savedSource: draft.text,
    hasDraft: true,
    draftSavedAt: draft.savedAt,
    draftBaseHash: draft.baseHash,
  };
};

type StoredPatch = Pick<DocumentSession, 'status'> &
  Partial<
    Pick<
      DocumentSession,
      'savedSource' | 'hasDraft' | 'draftSavedAt' | 'draftBaseHash'
    >
  >;

const persist = (session: DocumentSession): StoredPatch => {
  if (session.source === session.diskText) {
    removeDraft(session.folderName, session.path);
    return {
      savedSource: session.source,
      hasDraft: false,
      draftSavedAt: null,
      draftBaseHash: null,
      status: 'saved',
    };
  }

  const record = saveDraft(
    session.folderName,
    session.path,
    session.source,
    hashText(session.diskText),
  );

  if (!record) {
    return { status: 'error' };
  }

  return {
    savedSource: session.source,
    hasDraft: true,
    draftSavedAt: record.savedAt,
    draftBaseHash: record.baseHash,
    status: 'saved',
  };
};

/**
 * Loads the on-disk text plus the local draft for one file, autosaves edits
 * back to `localStorage` and never requests write access to the file.
 */
export function useDocumentSession(
  file: LocalFile | null,
  folderName: string,
  readText: (path: string, fresh?: boolean) => Promise<string>,
): DocumentSessionState {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const sessionRef = useRef<DocumentSession | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Source value that failed to persist, to avoid a 500 ms retry loop. */
  const failedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const flush = useCallback((current: DocumentSession | null) => {
    if (!current) return;
    if (current.source === current.diskText) {
      removeDraft(current.folderName, current.path);
      return;
    }
    if (current.source === current.savedSource && current.hasDraft) return;
    saveDraft(
      current.folderName,
      current.path,
      current.source,
      hashText(current.diskText),
    );
  }, []);

  // Load the file whenever it changes. The cleanup flushes the previous file's
  // pending edits so switching files never loses the last 500 ms of typing.
  useEffect(() => {
    if (!file || folderName.length === 0) {
      flush(sessionRef.current);
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSession(null);

    void (async () => {
      try {
        const diskText = await readText(file.path);
        if (cancelled) return;

        const draft = loadDraft(folderName, file.path);
        setSession(createSession(folderName, file.path, diskText, draft));
        setLoading(false);
      } catch (reason) {
        if (cancelled) return;
        setSession(null);
        setError(errorMessage(reason));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      flush(sessionRef.current);
    };
  }, [file, folderName, flush, readText, reloadTick]);

  const setSource = useCallback((next: string) => {
    setSession((previous) => {
      if (!previous) return previous;
      if (previous.source === next) return previous;
      return {
        ...previous,
        source: next,
        status: next === previous.savedSource ? 'saved' : 'saving',
        // Editing is an implicit decision to keep the buffer; the stale draft
        // offer must not replace the user's new text later.
        conflict: null,
      };
    });
  }, []);

  const saveNow = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const current = sessionRef.current;
    if (!current) return;

    failedSourceRef.current = current.source;
    const patch = persist(current);
    setSession((previous) =>
      previous && previous.path === current.path
        ? { ...previous, ...patch }
        : previous,
    );
  }, []);

  // Debounced autosave. `status` is switched to "saving" in `setSource`, so the
  // status bar reacts immediately while writes stay debounced.
  useEffect(() => {
    if (!session) return;
    if (session.source === session.savedSource) {
      failedSourceRef.current = null;
      return;
    }
    // A failed write stays failed until the text changes or the user presses
    // Ctrl/Cmd+S; retrying the same value every 500 ms only burns CPU.
    if (
      session.status === 'error' &&
      failedSourceRef.current === session.source
    ) {
      return;
    }

    const path = session.path;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const current = sessionRef.current;
      if (!current || current.path !== path) return;
      if (current.source === current.savedSource) return;

      failedSourceRef.current = current.source;
      const patch = persist(current);
      setSession((previous) =>
        previous && previous.path === path
          ? { ...previous, ...patch }
          : previous,
      );
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session]);

  // A reload or tab close must not lose the last debounce window.
  useEffect(() => {
    const flushNow = () => flush(sessionRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };

    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flush]);

  const resetDraft = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    removeDraft(current.folderName, current.path);
    setSession({
      ...current,
      source: current.diskText,
      savedSource: current.diskText,
      hasDraft: false,
      draftSavedAt: null,
      draftBaseHash: null,
      status: 'saved',
      conflict: null,
    });
  }, []);

  const reloadFromDisk = useCallback(async (): Promise<string> => {
    const current = sessionRef.current;
    if (!current) return '';
    // Read fresh text without changing the session yet: the caller decides
    // whether to replace the buffer or keep the draft against the new version.
    return readText(current.path, true);
  }, [readText]);

  const useDiskVersion = useCallback((diskText: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setSession((previous) => {
      if (!previous) return previous;
      removeDraft(previous.folderName, previous.path);
      return {
        ...previous,
        diskText,
        source: diskText,
        savedSource: diskText,
        hasDraft: false,
        draftSavedAt: null,
        draftBaseHash: null,
        status: 'saved',
        conflict: null,
      };
    });
  }, []);

  const keepDraftAsBaseline = useCallback((diskText: string) => {
    failedSourceRef.current = null;
    setSession((previous) => {
      if (!previous) return previous;
      const baseHash = hashText(diskText);
      if (previous.source === diskText) {
        removeDraft(previous.folderName, previous.path);
        return {
          ...previous,
          diskText,
          savedSource: diskText,
          hasDraft: false,
          draftSavedAt: null,
          draftBaseHash: null,
          status: 'saved',
          conflict: null,
        };
      }

      const record = saveDraft(
        previous.folderName,
        previous.path,
        previous.source,
        baseHash,
      );

      return {
        ...previous,
        diskText,
        savedSource: record ? previous.source : previous.savedSource,
        hasDraft: record !== null,
        draftSavedAt: record?.savedAt ?? null,
        draftBaseHash: baseHash,
        status: record ? 'saved' : 'error',
        conflict: null,
      };
    });
  }, []);

  const retry = useCallback(() => setReloadTick((tick) => tick + 1), []);

  const resolveConflict = useCallback((choice: 'disk' | 'draft') => {
    const current = sessionRef.current;
    if (!current) return;

    failedSourceRef.current = null;

    if (choice === 'disk' || !current.conflict) {
      removeDraft(current.folderName, current.path);
      setSession({
        ...current,
        source: current.diskText,
        savedSource: current.diskText,
        hasDraft: false,
        draftSavedAt: null,
        draftBaseHash: null,
        status: 'saved',
        conflict: null,
      });
      return;
    }

    setSession({
      ...current,
      source: current.conflict.text,
      status: 'saving',
      conflict: null,
    });
  }, []);

  const actions: DocumentSessionActions = {
    setSource,
    saveNow,
    resetDraft,
    reloadFromDisk,
    useDiskVersion,
    keepDraftAsBaseline,
    resolveConflict,
    retry,
  };

  return { session, loading, error, actions };
}
