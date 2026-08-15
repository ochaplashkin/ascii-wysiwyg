import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import Quill from 'quill';
import QuillTableBetter from "quill-table-better";


import 'quill/dist/quill.snow.css';
import './styles.css';
import "quill-table-better/dist/quill-table-better.css";


Quill.register({ "modules/table-better": QuillTableBetter }, true);

// const QuillTableBetterDemo = () => {
  
//     const editor = quillRef.current.getEditor();
//     const delta = editor.clipboard.convert({ html });
//     const [range] = editor.selection.getRange();
//     editor.updateContents(delta, Quill.sources.USER);
//     editor.setSelection(
//       delta.length() - (range?.length || 0),
//       Quill.sources.SILENT
//     );
//     editor.scrollSelectionIntoView();
//   }

//   useEffect(() => {
//     if (quillRef.current) initValue();
//   }, [quillRef]);

//   return <ReactQuill ref={quillRef} theme={"snow"} modules={modules} />;
// };

// export default QuillTableBetterDemo;




interface EditorProps {
  readOnly?: boolean;
  defaultValue?: any;
  onTextChange?: (...args: any[]) => void;
  onSaveBtn?: (...args: any[]) => void;
  onSelectionChange?: (...args: any[]) => void;
}


const Editor = forwardRef<Quill | null, EditorProps>(
  ({ readOnly = false, defaultValue, onTextChange, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const defaultValueRef = useRef(defaultValue);
    const onTextChangeRef = useRef(onTextChange);
    const onSelectionChangeRef = useRef(onSelectionChange);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
    });

    useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.enable(!readOnly);
      }
    }, [ref, readOnly]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const editorContainer = container.appendChild(
        container.ownerDocument.createElement('div'),
      );

      const toolbarOptions = [
        // ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        // ['blockquote', 'code-block'],

        // [{ 'header': 1 }, { 'header': 2 }],               // custom button values
        // [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
        // [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
        // [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
        // [{ 'direction': 'rtl' }],                         // text direction

        // [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['link'],
        ['blockquote'],

        // [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        // [{ 'font': [] }],
        // [{ 'align': [] }],

        // ['clean']                                         // remove formatting button
        ["table-better"] // Table tool here
      ];
      
      const options: any = {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarOptions
          },
          table: false,
          "table-better": {
            language: "ru_RU",
            menus: [
              "column",
              "row",
              "merge",
              "table",
              "cell",
              "wrap",
              "copy",
              "delete",
            ],
            toolbarTable: true,
          },
          // keyboard: {
          //   bindings: QuillTableBetter.keyboardBindings
          // }
        }
      };

      const quill = new Quill(editorContainer, options);
      

      if (ref) {
        if (typeof ref === 'function') {
          ref(quill);
        } else {
          ref.current = quill;
        }
      }

      if (defaultValueRef.current) {
        quill.setContents(defaultValueRef.current);
      }

      quill.on(Quill.events.TEXT_CHANGE, (...args: any[]) => {
        onTextChangeRef.current?.(...args);
      });

      quill.on(Quill.events.SELECTION_CHANGE, (...args: any[]) => {
        onSelectionChangeRef.current?.(...args);
      });

      return () => {
        if (ref) {
          if (typeof ref === 'function') {
            ref(null);
          } else {
            ref.current = null;
          }
        }
        container.innerHTML = '';
      };
    }, [ref]);

    return <div ref={containerRef}></div>;
  },
);

Editor.displayName = 'Editor';

export default Editor;
