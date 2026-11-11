// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileRow } from './FileRow.js';

describe('FileRow', () => {
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
  });

  it('disables comparison for a PlantUML diagram', async () => {
    await act(async () =>
      root.render(
        <FileRow
          path="diagrams/flow.puml"
          name="flow.puml"
          active={false}
          slot={null}
          locked={false}
          comparable={false}
          hasDraft={false}
          query=""
          onOpen={() => {}}
          onToggle={() => {}}
        />,
      ),
    );

    const checkbox = container.querySelector<HTMLInputElement>(
      '.ws-file__checkbox input',
    );
    expect(checkbox?.disabled).toBe(true);
    expect(container.querySelector('.ws-file__checkbox')?.getAttribute(
      'title',
    )).toContain('не участвуют в сравнении');
  });

  it('keeps comparison available for an AsciiDoc document and opens it', async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();

    await act(async () =>
      root.render(
        <FileRow
          path="docs/guide.adoc"
          name="guide.adoc"
          active={false}
          slot={null}
          locked={false}
          comparable
          hasDraft={false}
          query=""
          onOpen={onOpen}
          onToggle={onToggle}
        />,
      ),
    );

    const checkbox = container.querySelector<HTMLInputElement>(
      '.ws-file__checkbox input',
    );
    expect(checkbox?.disabled).toBe(false);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.ws-file__name')?.click();
    });
    expect(onOpen).toHaveBeenCalledWith('docs/guide.adoc');
  });
});
