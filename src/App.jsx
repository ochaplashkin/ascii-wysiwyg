import React, { useRef, useState } from 'react';
import Quill from 'quill/core';
import Editor from '/src/components/editor/Editor.jsx';
import Highlighter from './components/highlighter/Highlighter';
import ThemePicker from './components/highlighter/ThemePicker';

import './index.css'

const Delta = Quill.import('delta');

const App = () => {
  const [range, setRange] = useState();
  const [lastChange, setLastChange] = useState();
  const [readOnly, setReadOnly] = useState(false);

  const [theme, setTheme] = useState('github');

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  return (
    <div>
      <ThemePicker theme={theme} f={(e) => { setTheme(e)} }/>
      <Highlighter theme={theme}>k
        {'= Hello, AsciiDoc!\nDoc Writer <doc@example.com>\nAn introduction to http://asciidoc.org[AsciiDoc].\n== First Section\n[source,ruby]\nputs "Hello, World!"'}
      </Highlighter>
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
      <div className="controls">
        <label>
          Read Only:{' '}
          <input
            type="checkbox"
            value={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
        </label>
        <button
          className="controls-right"
          type="button"
          onClick={() => {
            alert(quillRef.current?.getLength());
          }}
        >
          Get Content Length
        </button>
      </div>
      <div className="state">
        <div className="state-title">Current Range:</div>
        {range ? JSON.stringify(range) : 'Empty'}
      </div>
      <div className="state">
        <div className="state-title">Last Change:</div>
        {lastChange ? JSON.stringify(lastChange.ops) : 'Empty'}
      </div>
    </div>
  );
};

export default App;