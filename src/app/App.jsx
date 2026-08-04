import React, { useRef, useState } from 'react';
import Quill from 'quill/core';
import Editor from '/src/widgets/editor/Editor';
import Highlighter from '/src/widgets/highlighter/Highlighter';
import ThemePicker from '/src/widgets/highlighter/ThemePicker';
import WorkareaLaylout from '/src/pages/WorkareaPage'
import { Container } from '@mui/material';

const Delta = Quill.import('delta');

const App = () => {
  const [range, setRange] = useState();
  const [lastChange, setLastChange] = useState();
  const [readOnly, setReadOnly] = useState(false);

  const [theme, setTheme] = useState('github');

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  return (
    <WorkareaLaylout
      leftContent={
        <Editor
        ref={quillRef}
        readOnly={readOnly}
        defaultValue={new Delta()
          .insert('Hello')
          .insert('\n', { header: 1 })
          .insert('Some ')
          .insert('initial', { bold: true })
          .insert(' ')
          .insert('content', { underline: true })
          .insert('\n')}
        onSelectionChange={setRange}
        onTextChange={setLastChange}
      />
      }
      rightContent={
        <Container>
        <ThemePicker theme={theme} f={(e) => { setTheme(e)} }/>
          <Highlighter theme={theme}>
            {'= Hello, AsciiDoc!\nDoc Writer <doc@example.com>\nAn introduction to http://asciidoc.org[AsciiDoc].\n== First Section\n[source,ruby]\nputs "Hello, World!"'}
          </Highlighter>
        </Container>
      }
    />
  );
};

export default App;