// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  KROKI_URL_STORAGE_KEY,
  krokiHealthUrl,
  krokiPageUrl,
  normalizeKrokiBase,
  readKrokiUrl,
} from './kroki-url.js';

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('normalizeKrokiBase', () => {
  it('trims whitespace and strips trailing slashes', () => {
    expect(normalizeKrokiBase('  /kroki/  ')).toBe('/kroki');
    expect(normalizeKrokiBase('/kroki///')).toBe('/kroki');
  });

  it('keeps absolute URLs', () => {
    expect(normalizeKrokiBase('https://kroki.example/')).toBe(
      'https://kroki.example',
    );
  });

  it('returns null for blank and slash-only values', () => {
    expect(normalizeKrokiBase(undefined)).toBeNull();
    expect(normalizeKrokiBase(null)).toBeNull();
    expect(normalizeKrokiBase('   ')).toBeNull();
    expect(normalizeKrokiBase('/')).toBeNull();
  });
});

describe('Kroki URL builders', () => {
  it('builds the services page URL', () => {
    expect(krokiPageUrl('/kroki')).toBe('/kroki/');
    expect(krokiPageUrl('https://kroki.example')).toBe(
      'https://kroki.example/',
    );
  });

  it('builds the health URL without a duplicate slash', () => {
    expect(krokiHealthUrl('/kroki')).toBe('/kroki/health');
    expect(krokiHealthUrl('https://kroki.example')).toBe(
      'https://kroki.example/health',
    );
  });
});

describe('readKrokiUrl', () => {
  it('falls back to the build-time env value', () => {
    vi.stubEnv('VITE_KROKI_URL', '/kroki/');
    expect(readKrokiUrl()).toBe('/kroki');
  });

  it('prefers a stored override', () => {
    vi.stubEnv('VITE_KROKI_URL', '/kroki');
    localStorage.setItem(KROKI_URL_STORAGE_KEY, 'https://kroki.example/');
    expect(readKrokiUrl()).toBe('https://kroki.example');
  });

  it('treats a blank stored override as disabled', () => {
    vi.stubEnv('VITE_KROKI_URL', '/kroki');
    localStorage.setItem(KROKI_URL_STORAGE_KEY, '   ');
    expect(readKrokiUrl()).toBeNull();
  });

  it('returns null when nothing is configured', () => {
    vi.stubEnv('VITE_KROKI_URL', '');
    expect(readKrokiUrl()).toBeNull();
  });
});
