import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Editor from '/src/widgets/editor/Editor';
import Highlighter from '/src/widgets/highlighter/Highlighter';
import ThemePicker from '/src/widgets/highlighter/ThemePicker';
import WorkareaLaylout from '/src/pages/WorkareaPage'
import { Box, CircularProgress, Container, Tab, Tabs } from '@mui/material';

const AsciiDocDiffPage = lazy(
  () => import('../features/asciidoc-diff/ui/AsciiDocDiffPage'),
);

const App = () => {
  const [source, setSourceCode] = useState('== Test');

  const [theme, setTheme] = useState('github');
  const [tab, setTab] = useState(() =>
    window.location.hash === '#diff' ? 1 : 0,
  );
  const [diffVisited, setDiffVisited] = useState(
    () => window.location.hash === '#diff',
  );

  // Use a ref to access the quill instance directly
  const quillRef = useRef();

  useEffect(() => {
    const syncTabWithHash = () => {
      const nextTab = window.location.hash === '#diff' ? 1 : 0;
      setTab(nextTab);
      if (nextTab === 1) {
        setDiffVisited(true);
      }
    };

    window.addEventListener('hashchange', syncTabWithHash);
    return () => window.removeEventListener('hashchange', syncTabWithHash);
  }, []);

  const handleTabChange = (_event, value) => {
    setTab(value);
    if (value === 1) {
      setDiffVisited(true);
    }

    const nextUrl =
      value === 1
        ? '#diff'
        : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', nextUrl);
  };

  const handleTextChange = () => {
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

  const tableToAsciidoc = (table) => {
    table = new DOMParser().parseFromString(`
      <document>
        ${table}
      </document>
      `, "text/html")
    const rows = [];
    const trs = Array.from(table.querySelectorAll('tr'));

    for (const tr of trs) {
      const cells = Array.from(tr.children).filter((child)  => {
        const tag = child.tagName.toLowerCase();
        return tag === 'td' || tag === 'th';
      });
      rows.push(cells.map((cell) => cell.textContent.trim()));
    }

    const colCount = rows.length > 0 ? rows[0].length : 0;
    const colsSpec = Array(colCount).fill('1').join(',');

    let result = `[cols="${colsSpec}"]\n|===\n`;

    rows.forEach((row) => {
      result += row.map((cell) => `|${cell}`).join('\n') + '\n\n';
    });

    result += '|===\n';
    return result;
  }

  const processHMTLtoASCII = (html) => {
    // too bad design, MUST be rewriting later
    const {url, text} = parseAnchor(html)
    if (url && text){
      html = html.replaceAll(/<a[^>]*>(.*?)<\/a>/gi, `${url}[${text}]`)
    }

    // FIX: only first table will be convert to asciidoc within values
    const tableRegex = /<\s*table[^>]*>[\s\S]*?<\s*\/\s*table\s*>/gi
    const matches = html.match(tableRegex)
    if (matches) {
      html = html.replaceAll(/<\s*table[^>]*>[\s\S]*?<\s*\/\s*table\s*>/gi, `${tableToAsciidoc(matches[0])}`)
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label="Разделы приложения"
          sx={{ px: 2 }}
        >
          <Tab
            label="Редактор"
            id="tab-editor"
            aria-controls="panel-editor"
          />
          <Tab
            label="Сравнение AsciiDoc"
            id="tab-diff"
            aria-controls="panel-diff"
          />
        </Tabs>
      </Box>

      <Box
        role="tabpanel"
        id="panel-editor"
        aria-labelledby="tab-editor"
        sx={{ display: tab === 0 ? 'block' : 'none' }}
      >
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
      </Box>

      <Box
        role="tabpanel"
        id="panel-diff"
        aria-labelledby="tab-diff"
        sx={{
          display: tab === 1 ? 'flex' : 'none',
          flexDirection: 'column',
          height: 'calc(100vh - 49px)',
        }}
      >
        {diffVisited && (
          <Suspense
            fallback={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <CircularProgress size={28} />
              </Box>
            }
          >
            <AsciiDocDiffPage />
          </Suspense>
        )}
      </Box>
    </Box>
  );
};

export default App;
