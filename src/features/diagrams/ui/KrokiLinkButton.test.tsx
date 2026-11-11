// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KrokiHealthStatus } from '../model/useKrokiHealth.js';

const state = vi.hoisted(() => ({ status: 'ok' as KrokiHealthStatus }));

vi.mock('../model/useKrokiHealth.js', () => ({
  useKrokiHealth: () => ({ status: state.status, check: () => {} }),
}));

import { KrokiLinkButton } from './KrokiLinkButton.js';

describe('KrokiLinkButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    state.status = 'ok';
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders nothing without a configured URL', async () => {
    await act(async () => root.render(<KrokiLinkButton url={null} />));

    expect(container.querySelector('a')).toBeNull();
  });

  it('renders a safe external link to the services page', async () => {
    await act(async () => root.render(<KrokiLinkButton url="/kroki" />));

    const link = container.querySelector<HTMLAnchorElement>('a.se-kroki-link');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/kroki/');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('aria-label')).toBe(
      'Открыть сервис Kroki в новой вкладке',
    );
    expect(link?.getAttribute('data-health')).toBe('ok');
    expect(link?.textContent).toContain('Kroki');
  });

  it('reflects the availability state without disabling the link', async () => {
    state.status = 'error';

    await act(async () => root.render(<KrokiLinkButton url="/kroki" />));

    const link = container.querySelector<HTMLAnchorElement>('a.se-kroki-link');
    expect(link?.getAttribute('data-health')).toBe('error');
    expect(link?.getAttribute('href')).toBe('/kroki/');
    expect(link?.querySelector('.se-kroki-link__dot')?.getAttribute(
      'data-health',
    )).toBe('error');
    expect(link?.getAttribute('title')).toContain('недоступен');
  });
});
