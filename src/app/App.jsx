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
  const [source, setSourceCode] = useState('== Test');
  const [readOnly, setReadOnly] = useState(false);

  const [theme, setTheme] = useState('github');

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  const handleTextChange = (delta, oldDelta, sourceCode) => {
    if (quillRef.current) {
      const plainText = quillRef.current.getText();
      setSourceCode(plainText);
    }
  };

  return (
    <WorkareaLaylout
      leftContent={
        <Editor
          ref={quillRef}
          onTextChange={handleTextChange}
        />
      }
      rightContent={
        <Container>
          <ThemePicker theme={theme} f={(e) => { setTheme(e)} }/>
          <Highlighter theme={theme} source={source}></Highlighter>
        </Container>
      }
    />
  );
};

export default App;
