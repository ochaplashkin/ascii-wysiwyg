import { lazy, Suspense, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Box, CircularProgress, Tab, Tabs } from '@mui/material';

import { EditorPage } from '../features/editor/ui/EditorPage.js';

const AsciiDocDiffPage = lazy(
  () => import('../features/asciidoc-diff/ui/AsciiDocDiffPage.js'),
);

const tabFromHash = (): number =>
  window.location.hash === '#diff' ? 1 : 0;

/** Two top-level sections: the visual editor and the AsciiDoc diff viewer. */
const App = () => {
  const [tab, setTab] = useState(tabFromHash);
  const [diffVisited, setDiffVisited] = useState(
    () => window.location.hash === '#diff',
  );

  useEffect(() => {
    const syncTabWithHash = () => {
      const nextTab = tabFromHash();
      setTab(nextTab);
      if (nextTab === 1) {
        setDiffVisited(true);
      }
    };

    window.addEventListener('hashchange', syncTabWithHash);
    return () => window.removeEventListener('hashchange', syncTabWithHash);
  }, []);

  const handleTabChange = (_event: SyntheticEvent, value: number) => {
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
        <EditorPage />
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
