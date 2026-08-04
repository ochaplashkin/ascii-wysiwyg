// src/components/Layout.tsx
import React from 'react';
import type { ReactNode } from 'react';
import { Container, Box } from '@mui/material';

interface WorkareaLayloutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

const WorkareaLaylout: React.FC<WorkareaLayloutProps> = ({ leftContent, rightContent }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Container
        component="main"
        maxWidth={false}
        disableGutters
        sx={{ mt: 4, mb: 4, flex: 1 }}
        >
        <Box sx={{ display: 'flex', height: '100%' }}>
          <Box sx={{ flex: 1, p: 2, borderRight: '1px solid #ddd' }}>
            {leftContent}
          </Box>
          <Box sx={{ flex: 1, p: 2 }}>
            {rightContent}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default WorkareaLaylout;