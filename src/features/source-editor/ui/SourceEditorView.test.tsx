// @vitest-environment jsdom
import { act, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DocumentSession,
  DocumentSessionActions,
  DocumentSessionState,
} from '../../workspace/model/useDocumentSession.js';
import type { LocalFile } from '../../workspace/model/directory-access.js';

vi.mock('./CodeEditor.js', () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <div className="mock-code-editor">{value}</div>
  ),
}));

vi.mock('../model/usePreview.js', () => ({
  usePreview: () => ({
    html: '<p class="mock-preview">Предпросмотр</p>',
    warnings: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../editor/ui/VisualEditorView.js', async () => {
  const React = await import('react');

  return {
    default: ({
      onChange,
      onDirtyChange,
    }: {
      onChange: (source: string) => void;
      onDirtyChange: (dirty: boolean) => void;
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'mock-visual-edit',
          onClick: () => {
            onDirtyChange(true);
            onChange('= Документ\n\n__визуальная правка__');
          },
        },
        'visual edit',
      ),
  };
});

import { SourceEditorView } from './SourceEditorView.js';

const file: LocalFile = {
  path: 'chapters/doc.adoc',
  name: 'doc.adoc',
  read: async () => '= Документ\n\nТекст.',
};

const createSession = (
  overrides: Partial<DocumentSession> = {},
): DocumentSession => ({
  path: file.path,
  folderName: 'docs',
  diskText: '= Документ\n\nТекст.',
  source: '= Документ\n\nТекст.',
  savedSource: '= Документ\n\nТекст.',
  hasDraft: false,
  draftSavedAt: null,
  draftBaseHash: null,
  status: 'saved',
  conflict: null,
  ...overrides,
});

const actions: DocumentSessionActions = {
  setSource: vi.fn(),
  saveNow: vi.fn(),
  resetDraft: vi.fn(),
  reloadFromDisk: vi.fn(async () => ''),
  useDiskVersion: vi.fn(),
  keepDraftAsBaseline: vi.fn(),
  resolveConflict: vi.fn(),
  retry: vi.fn(),
};

function Harness({ initial = createSession() }: { initial?: DocumentSession }) {
  const [session, setSession] = useState<DocumentSession | null>(initial);

  const nextActions = useMemo<DocumentSessionActions>(
    () => ({
      ...actions,
      setSource: (source: string) => {
        setSession((previous) =>
          previous ? { ...previous, source, status: 'saving' } : previous,
        );
      },
    }),
    [],
  );

  const state: DocumentSessionState = {
    session,
    loading: false,
    error: null,
    actions: nextActions,
  };

  return (
    <SourceEditorView file={file} folderName="docs" sessionState={state} />
  );
}

const findButton = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes(text),
  );

describe('SourceEditorView', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders source, preview, stats and the draft badge', async () => {
    await act(async () =>
      root.render(<Harness initial={createSession({ hasDraft: true })} />),
    );

    expect(container.textContent).toContain('Черновик');
    expect(container.querySelector('.mock-code-editor')?.textContent).toContain(
      'Текст.',
    );
    expect(container.textContent).toContain('Предпросмотр');
    expect(container.textContent).toContain('Строк:');
    expect(container.textContent).toContain('Диск не меняется');
  });

  it('switches to visual mode without normalizing an untouched document', async () => {
    await act(async () => root.render(<Harness />));

    await act(async () => findButton(container, 'Визуально')?.click());

    await vi.waitFor(() => {
      expect(container.querySelector('.mock-visual-edit')).not.toBeNull();
    });

    await act(async () => findButton(container, 'Исходник')?.click());

    expect(container.querySelector('.se-normalization')).toBeNull();
    expect(container.querySelector('.mock-code-editor')).not.toBeNull();
  });

  it('shows the normalization panel after a visual edit', async () => {
    await act(async () => root.render(<Harness />));

    await act(async () => findButton(container, 'Визуально')?.click());
    await vi.waitFor(() => {
      expect(container.querySelector('.mock-visual-edit')).not.toBeNull();
    });

    await act(async () =>
      container.querySelector<HTMLButtonElement>('.mock-visual-edit')?.click(),
    );
    await act(async () => findButton(container, 'Исходник')?.click());

    expect(container.textContent).toContain('Разметка нормализована');
    expect(container.textContent).toContain('__визуальная правка__');
  });
});
