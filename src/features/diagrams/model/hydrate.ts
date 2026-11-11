import { hashString } from './hashing.js';
import {
  MAX_DIAGRAM_SOURCE_CHARS,
  resolveDiagramPath,
} from './path.js';
import { renderPlantUml } from './plantuml.js';
import type {
  DiagramRenderContext,
  PlantUmlOutcome,
  PlantUmlRequest,
} from './types.js';

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

/**
 * Reads the referenced `.puml` files and renders each one through Kroki.
 * Failures are per-diagram and never reject the whole document render.
 */
export async function renderDiagramRequests(
  requests: readonly PlantUmlRequest[],
  context: DiagramRenderContext,
): Promise<PlantUmlOutcome[]> {
  if (requests.length === 0) return [];

  const { krokiUrl, readAsset, baseDir } = context;

  if (!krokiUrl) {
    return requests.map((request) => ({
      request,
      dataUrl: null,
      sourceHash: null,
      error: 'Kroki не настроен: задайте VITE_KROKI_URL.',
    }));
  }

  if (!readAsset) {
    return requests.map((request) => ({
      request,
      dataUrl: null,
      sourceHash: null,
      error: 'Нет доступа к файлам выбранной папки.',
    }));
  }

  return Promise.all(
    requests.map(async (request): Promise<PlantUmlOutcome> => {
      const resolved = resolveDiagramPath(baseDir, request.target);
      if (!resolved) {
        return {
          request,
          dataUrl: null,
          sourceHash: null,
          error: `Недопустимый путь диаграммы «${request.target}».`,
        };
      }

      let source: string;
      try {
        source = await readAsset(resolved);
      } catch (reason) {
        return {
          request,
          dataUrl: null,
          sourceHash: null,
          error: `Не удалось прочитать «${resolved}»: ${errorMessage(reason)}`,
        };
      }

      if (source.length > MAX_DIAGRAM_SOURCE_CHARS) {
        return {
          request,
          dataUrl: null,
          sourceHash: null,
          error: `Файл «${resolved}» больше 256 КБ.`,
        };
      }

      if (source.trim().length === 0) {
        return {
          request,
          dataUrl: null,
          sourceHash: null,
          error: `Файл «${resolved}» пуст.`,
        };
      }

      const sourceHash = hashString(source);

      try {
        const result = await renderPlantUml(source, {
          url: krokiUrl,
          format: request.format,
        });

        return {
          request,
          dataUrl: result.dataUrl,
          sourceHash,
          error: null,
        };
      } catch (reason) {
        return {
          request,
          dataUrl: null,
          sourceHash,
          error: errorMessage(reason),
        };
      }
    }),
  );
}

const createCaption = (text: string): HTMLElement => {
  const caption = document.createElement('figcaption');
  caption.textContent = text;
  return caption;
};

const createDiagramNode = (outcome: PlantUmlOutcome): HTMLElement => {
  const figure = document.createElement('figure');

  if (outcome.dataUrl) {
    figure.className = 'adoc-puml adoc-puml--rendered';

    const image = document.createElement('img');
    image.className = 'adoc-puml__image';
    image.src = outcome.dataUrl;
    image.alt =
      outcome.request.alt ??
      outcome.request.title ??
      `PlantUML-диаграмма: ${outcome.request.target}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.append(image);

    if (outcome.request.title) {
      figure.append(createCaption(outcome.request.title));
    }

    return figure;
  }

  figure.className = 'adoc-puml adoc-puml--error';

  const message = document.createElement('p');
  message.className = 'adoc-puml__error';
  message.textContent = `PlantUML: ${outcome.error ?? 'не удалось отрисовать диаграмму'}`;
  figure.append(message);

  const source = document.createElement('pre');
  source.className = 'adoc-puml__source';
  source.textContent = `plantuml::${outcome.request.target}[]`;
  figure.append(source);

  return figure;
};

/**
 * Replaces pass-block placeholders in already sanitized HTML with rendered
 * figures. Inserted nodes are trusted: the SVG was sanitized separately and
 * is loaded through `<img>` as a data URL.
 */
export function hydrateDiagramHtml(
  html: string,
  outcomes: readonly PlantUmlOutcome[],
): string {
  if (outcomes.length === 0) return html;

  const byId = new Map(outcomes.map((outcome) => [outcome.request.id, outcome]));
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('[id]').forEach((element) => {
    const outcome = byId.get(element.getAttribute('id') ?? '');
    if (outcome) element.replaceWith(createDiagramNode(outcome));
  });

  return template.innerHTML;
}

/**
 * Removes render-specific placeholder ids from the HTML used to build a diff
 * key. The render id differs on every conversion; without this, equal
 * documents would produce different keys just because their diagrams were
 * rendered in different order.
 */
export function diagramKeyHtml(
  html: string,
  outcomes: readonly PlantUmlOutcome[],
): string {
  if (outcomes.length === 0) return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  template.content
    .querySelectorAll('.adoc-puml[id]')
    .forEach((element) => element.removeAttribute('id'));

  return template.innerHTML;
}

/**
 * Extra diff-key material for the diagram blocks inside one sanitized block.
 *
 * The placeholder HTML already contains the target path; the hash of the
 * resolved `.puml` content is appended here so editing a referenced file
 * counts as a change even if the macro line is untouched.
 */
export function diagramKeyExtra(
  html: string,
  outcomes: readonly PlantUmlOutcome[],
): string {
  if (outcomes.length === 0) return '';

  const byId = new Map(outcomes.map((outcome) => [outcome.request.id, outcome]));
  const template = document.createElement('template');
  template.innerHTML = html;
  const parts: string[] = [];

  template.content.querySelectorAll('[id]').forEach((element) => {
    const outcome = byId.get(element.getAttribute('id') ?? '');
    if (!outcome) return;
    parts.push(
      [
        outcome.request.format,
        outcome.request.target,
        outcome.request.title ?? '',
        outcome.request.alt ?? '',
        outcome.sourceHash ?? outcome.error ?? '',
      ].join('\u0000'),
    );
  });

  return parts.length > 0 ? `\u0000${parts.join('\u0000')}` : '';
}

/** Diagram failures are surfaced next to normal Asciidoctor warnings. */
export function diagramWarnings(
  outcomes: readonly PlantUmlOutcome[],
): { severity: string; text: string; line: number | null }[] {
  return outcomes
    .filter((outcome) => outcome.error !== null)
    .map((outcome) => ({
      severity: 'WARN',
      text: `PlantUML «${outcome.request.target}»: ${outcome.error}`,
      line: outcome.request.line,
    }));
}
