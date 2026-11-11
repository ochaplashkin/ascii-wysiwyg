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

import { IconButton } from '../../../shared/ui/controls.js';
import { Icon } from '../../../shared/ui/icons.js';

export interface DocumentMenuProps {
  hasDraft: boolean;
  onReloadFromDisk: () => void;
  onResetDraft: () => void;
}

/** File-level actions: re-read from disk, discard the local draft. */
export function DocumentMenu({
  hasDraft,
  onReloadFromDisk,
  onResetDraft,
}: DocumentMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = anchorEl !== null;
  const close = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        icon="more"
        label="Меню файла"
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
        slotProps={{ paper: { sx: { minWidth: 280, borderRadius: 2 } } }}
      >
        <MenuItem
          onClick={() => {
            close();
            onReloadFromDisk();
          }}
        >
          <ListItemIcon>
            <Icon name="refresh" size={16} />
          </ListItemIcon>
          <ListItemText>Перечитать с диска</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onResetDraft();
          }}
          disabled={!hasDraft}
        >
          <ListItemIcon>
            <Icon name="trash" size={16} />
          </ListItemIcon>
          <ListItemText>Сбросить черновик</ListItemText>
        </MenuItem>
        <Divider />
        <Box sx={{ px: 2, py: 1.25, maxWidth: 320 }}>
          <Typography variant="caption" color="text.secondary">
            Изменения хранятся только в этом браузере. Исходный файл на диске не
            меняется, запись не запрашивается.
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
