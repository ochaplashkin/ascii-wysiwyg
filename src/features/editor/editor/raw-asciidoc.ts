import { Node } from '@tiptap/core';

/**
 * Atomic block that keeps AsciiDoc markup the visual editor cannot represent.
 *
 * The original lines are stored verbatim in the `text` attribute so the
 * serializer can write them back unchanged (see the `rawAsciiDoc` case in
 * `model/asciidoc/serialize.ts`).
 */
export const RawAsciiDoc = Node.create({
  name: 'rawAsciiDoc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      text: {
        default: '',
        // The raw text is rendered inside <code>, not as an attribute.
        renderHTML: () => ({}),
        parseHTML: (element: HTMLElement) => element.textContent ?? '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'pre[data-raw-asciidoc]' }];
  },

  renderHTML({ node }) {
    const text = typeof node.attrs.text === 'string' ? node.attrs.text : '';
    return [
      'pre',
      { class: 'raw-asciidoc', 'data-raw-asciidoc': 'true' },
      ['code', {}, text],
    ];
  },
});

export default RawAsciiDoc;
