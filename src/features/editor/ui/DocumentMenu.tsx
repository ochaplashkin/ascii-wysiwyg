import { useState } from 'react';
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';

import { IconButton } from './controls.js';
import { DownloadIcon, PlusIcon } from './icons.js';

export interface DocumentMenuProps {
  onNewDocument: () => void;
  onDownload: () => void;
}

/** "⋯" menu with document-level actions and storage information. */
export function DocumentMenu({ onNewDocument, onDownload }: DocumentMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;

  const close = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        icon="more"
        label="Меню документа"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open}
      />
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260, borderRadius: 2 } } }}
      >
        <MenuItem
          onClick={() => {
            close();
            onNewDocument();
          }}
        >
          <ListItemIcon>
            <PlusIcon />
          </ListItemIcon>
          <ListItemText>Новый документ</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onDownload();
          }}
        >
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>Скачать .adoc</ListItemText>
        </MenuItem>
        <Divider />
        <Box sx={{ px: 2, py: 1.25, maxWidth: 300 }}>
          <Typography variant="caption" color="text.secondary">
            Документ хранится только в этом браузере (localStorage). Чтобы
            сохранить копию, скачайте файл .adoc.
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
