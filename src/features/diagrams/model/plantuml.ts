import { hashString } from './hashing.js';
import { normalizeKrokiBase } from './kroki-url.js';
import { sanitizeSvg } from './sanitize-svg.js';
import type { PlantUmlFormat } from './types.js';

/** Kroki may need several seconds for a cold JVM; the client waits less. */
export const PLANTUML_TIMEOUT_MS = 15000;

const CACHE_LIMIT = 60;
const cache = new Map<string, PlantUmlRenderResult>();

export interface PlantUmlRenderResult {
  /** Base64 data URL suitable for an `<img src>`. */
  dataUrl: string;
  format: PlantUmlFormat;
}

export interface PlantUmlRenderOptions {
  /** Kroki base URL, for example `/kroki` or `https://kroki.example`. */
  url: string;
  format?: PlantUmlFormat;
  /** Caller-owned cancellation (unmount, stale preview request). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

const svgToDataUrl = (svg: string): string =>
  `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`;

const remember = (key: string, result: PlantUmlRenderResult): void => {
  // Refresh insertion order so Map behaves like a small LRU.
  cache.delete(key);
  cache.set(key, result);

  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

/** Exposed for tests and for a future "clear diagram cache" action. */
export function clearPlantUmlCache(): void {
  cache.clear();
}

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text.replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    return '';
  }
};

/**
 * Renders PlantUML source through Kroki (`POST /plantuml/:format`) and returns
 * an image data URL. Results are cached by endpoint, format and source hash.
 */
export async function renderPlantUml(
  source: string,
  options: PlantUmlRenderOptions,
): Promise<PlantUmlRenderResult> {
  const base = normalizeKrokiBase(options.url);
  if (!base) {
    throw new Error('Kroki не настроен: задайте VITE_KROKI_URL.');
  }

  const format = options.format ?? 'svg';
  const timeoutMs = options.timeoutMs ?? PLANTUML_TIMEOUT_MS;
  const cacheKey = `${base}|${format}|${hashString(source)}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    remember(cacheKey, cached);
    return cached;
  }

  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${base}/plantuml/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Accept: format === 'svg' ? 'image/svg+xml' : 'image/png',
        },
        body: source,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (reason) {
      if (timedOut) {
        throw new Error(
          `Kroki не ответил за ${Math.round(timeoutMs / 1000)} с.`,
        );
      }
      if (externalSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      throw new Error(
        `Не удалось связаться с Kroki (${base}): ${errorMessage(reason)}`,
      );
    }

    if (!response.ok) {
      const snippet = await readErrorBody(response);
      throw new Error(
        `Kroki вернул ${response.status}${snippet ? `: ${snippet}` : ''}`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (format === 'svg') {
      if (contentType && !contentType.includes('image/svg+xml')) {
        throw new Error(
          `Kroki вернул неожиданный тип «${contentType}» вместо image/svg+xml.`,
        );
      }

      const raw = await response.text();
      const clean = sanitizeSvg(raw);
      if (!clean.includes('<svg')) {
        throw new Error('Kroki вернул пустой или некорректный SVG.');
      }

      const result: PlantUmlRenderResult = {
        dataUrl: svgToDataUrl(clean),
        format,
      };
      remember(cacheKey, result);
      return result;
    }

    if (contentType && !contentType.includes('image/png')) {
      throw new Error(
        `Kroki вернул неожиданный тип «${contentType}» вместо image/png.`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error('Kroki вернул пустое PNG-изображение.');
    }

    const result: PlantUmlRenderResult = {
      dataUrl: `data:image/png;base64,${bytesToBase64(bytes)}`,
      format,
    };
    remember(cacheKey, result);
    return result;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
