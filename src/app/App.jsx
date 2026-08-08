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
      const plainText = quillRef.current.getSemanticHTML();
      setSourceCode(processHMTLtoASCII(plainText));
    }
  };

  const parseAnchor = (html) => {
    // <a href="https://google.com" rel="noopener noreferrer" target="_blank">foo</a>
    // url -> https://google.com
    // text -> foo
    // TODO: only works the first time
    const regex = /<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/i;
    const match = html.match(regex);
    if (match) {
        return {
            url: match[1],
            text: match[2]
        }
    }
    return {};
}

  const processHMTLtoASCII = (html) => {
    const {url, text} = parseAnchor(html)
    if (url && text){
      html = html.replaceAll(/<a[^>]*>(.*?)<\/a>/gi, `${url}[${text}]`)
    }

    return html
      .replaceAll('<p>',  '\n')
      .replaceAll('</p>', '\n')
      .replaceAll('<h1>', '\n= ')
      .replaceAll('</h1>', '\n')
      .replaceAll('<h2>', '\n== ')
      .replaceAll('</h2>', '\n')
      .replaceAll('<h3>', '\n=== ')
      .replaceAll('</h3>', '\n')
      .replaceAll('<strong>', '**')
      .replaceAll('</strong>', '**')
      .replaceAll('<em>', '__')
      .replaceAll('</em>', '__')
      .replaceAll('<s>', '+++<s>')
      .replaceAll('</s>', '</s>+++')
      .replaceAll('<u>', '+++<u>')
      .replaceAll('</u>', '</u>+++')
      .replaceAll('<blockquote>', '\n> ')
      .replaceAll('</blockquote>', '\n')
  }

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
