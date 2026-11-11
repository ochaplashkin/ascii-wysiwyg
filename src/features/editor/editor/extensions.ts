import { Extension } from '@tiptap/core';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

import { RawAsciiDoc } from './raw-asciidoc.js';

/**
 * Single Tiptap configuration used by the editor.
 *
 * Link and Underline are already part of StarterKit in Tiptap 3, so they are
 * configured there instead of being registered twice.
 */
const AsciiDocShortcuts = Extension.create({
  name: 'asciidocShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-.': () => this.editor.commands.toggleBlockquote(),
    };
  },
});

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5],
      },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading'
          ? 'Заголовок'
          : 'Начните писать или нажмите «/», чтобы вставить блок…',
      showOnlyWhenEditable: true,
      emptyEditorClass: 'is-editor-empty',
    }),
    CharacterCount,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TableKit.configure({
      table: {
        resizable: true,
        allowTableNodeSelection: true,
      },
    }),
    Superscript,
    Subscript,
    RawAsciiDoc,
    AsciiDocShortcuts,
  ];
}
