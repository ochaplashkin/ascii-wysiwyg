// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  renderAsciiDoc,
  renderAsciiDocPreview,
} from '../../asciidoc-diff/model/render.js';
import { clearPlantUmlCache } from './plantuml.js';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const svgFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(SVG, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => clearPlantUmlCache());

afterEach(() => vi.unstubAllGlobals());

describe('plantuml:: macro', () => {
  it('renders a referenced .puml file in the preview', async () => {
    const fetchMock = svgFetch();
    const readAsset = vi.fn(async (path: string) => {
      expect(path).toBe('docs/diagrams/flow.puml');
      return '@startuml\nAlice -> Bob\n@enduml';
    });

    const { html, warnings } = await renderAsciiDocPreview(
      '= Guide\n\nplantuml::diagrams/flow.puml[title="Схема"]\n',
      { baseDir: 'docs', readAsset, krokiUrl: '/kroki' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/kroki/plantuml/svg');
    expect(html).toContain('adoc-puml--rendered');
    expect(html).toContain('data:image/svg+xml;base64,');
    expect(html).toContain('Схема');
    expect(html).not.toContain('adoc-puml--pending');
    expect(warnings).toEqual([]);
  });

  it('keeps the document readable when the file is missing', async () => {
    const fetchMock = svgFetch();

    const { html, warnings } = await renderAsciiDocPreview(
      'Before.\n\nplantuml::missing.puml[]\n\nAfter.\n',
      {
        baseDir: 'docs',
        readAsset: async () => {
          throw new Error('not found');
        },
        krokiUrl: '/kroki',
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain('Before.');
    expect(html).toContain('After.');
    expect(html).toContain('adoc-puml--error');
    expect(html).toContain('not found');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.text).toContain('PlantUML');
  });

  it('rejects path traversal without reading the file', async () => {
    const readAsset = vi.fn();

    const { html, warnings } = await renderAsciiDocPreview(
      'plantuml::../../outside.puml[]',
      { baseDir: 'docs', readAsset, krokiUrl: '/kroki' },
    );

    expect(readAsset).not.toHaveBeenCalled();
    expect(html).toContain('Недопустимый путь');
    expect(warnings).toHaveLength(1);
  });

  it('explains a missing Kroki endpoint', async () => {
    const { html, warnings } = await renderAsciiDocPreview(
      'plantuml::diagrams/flow.puml[]',
      {
        baseDir: 'docs',
        readAsset: async () => '@startuml\nA -> B\n@enduml',
        krokiUrl: null,
      },
    );

    expect(html).toContain('adoc-puml--error');
    expect(html).toContain('Kroki не настроен');
    expect(warnings).toHaveLength(1);
  });

  it('includes the .puml source hash in diff block keys', async () => {
    svgFetch();

    const render = (content: string, idPrefix: string) =>
      renderAsciiDoc('plantuml::diagrams/flow.puml[]', {
        idPrefix,
        baseDir: 'docs',
        readAsset: async () => content,
        krokiUrl: '/kroki',
      });

    const sameLeft = await render('@startuml\nA -> B\n@enduml', 'left');
    const sameRight = await render('@startuml\nA -> B\n@enduml', 'right');
    const changed = await render('@startuml\nA -> C\n@enduml', 'right');

    expect(sameLeft.blocks.map((block) => block.key)).toEqual(
      sameRight.blocks.map((block) => block.key),
    );
    expect(sameLeft.blocks[0]?.key).not.toBe(changed.blocks[0]?.key);
    expect(sameLeft.blocks[0]?.html).toContain('adoc-puml--rendered');
  });

  it('includes the caption and format in the diff key', async () => {
    svgFetch();

    const render = (attributes: string) =>
      renderAsciiDoc(`plantuml::diagrams/flow.puml[${attributes}]`, {
        baseDir: 'docs',
        readAsset: async (path) =>
          path === 'docs/diagrams/flow.puml'
            ? '@startuml\nA -> B\n@enduml'
            : Promise.reject(new Error('missing')),
        krokiUrl: '/kroki',
      });

    const plain = await render('format=svg');
    const captioned = await render('format=svg,title="Схема"');

    expect(plain.blocks[0]?.key).not.toBe(captioned.blocks[0]?.key);
  });

  it('leaves inline [plantuml] blocks as regular AsciiDoc', async () => {
    const { html } = await renderAsciiDocPreview(
      '[plantuml]\n----\n@startuml\nA -> B\n@enduml\n----\n',
    );

    expect(html).toContain('@startuml');
  });
});
