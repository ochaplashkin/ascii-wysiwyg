import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

import { DEMO_SOURCES } from './demo-sources.js';
import type { Side, SourceDoc, SourcePair } from './types.js';

interface SourceDialogProps {
  initial: SourcePair;
  focusSide: Side | null;
  onApply: (next: SourcePair) => void;
  onClose: () => void;
}

const countLines = (value: string) =>
  value.length === 0 ? 0 : value.split(/\r\n|\r|\n/).length;

const DEFAULT_NAMES: Record<Side, string> = {
  left: 'Оригинал',
  right: 'Изменённый',
};

const deriveName = (text: string, fallback: string): string => {
  const title = text.match(/^=\s+(.+)$/m)?.[1]?.trim();
  return title ? title.slice(0, 80) : fallback;
};

const fallbackName = (side: Side) =>
  side === 'left' ? 'Вставленный документ' : 'Изменённый документ';

const cloneSources = (sources: SourcePair): SourcePair => ({
  left: { ...sources.left },
  right: { ...sources.right },
});

export function SourceDialog({
  initial,
  focusSide,
  onApply,
  onClose,
}: SourceDialogProps) {
  const [draft, setDraft] = useState<SourcePair>(() => cloneSources(initial));
  const [nameTouched, setNameTouched] = useState<Record<Side, boolean>>(
    () => ({
      left: initial.left.nameTouched === true,
      right: initial.right.nameTouched === true,
    }),
  );
  const leftRef = useRef<HTMLTextAreaElement | null>(null);
  const rightRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const target =
      focusSide === 'left'
        ? leftRef.current
        : focusSide === 'right'
          ? rightRef.current
          : null;

    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(target.value.length, target.value.length);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusSide]);

  const update = (side: Side, patch: Partial<SourceDoc>) => {
    setDraft((previous) => {
      const nextDoc = { ...previous[side], ...patch };

      if (patch.text !== undefined && !nameTouched[side]) {
        nextDoc.name = deriveName(patch.text, fallbackName(side));
      }

      return { ...previous, [side]: nextDoc };
    });
  };

  const apply = () => {
    onApply({
      left: {
        ...draft.left,
        name: draft.left.name.trim() || DEFAULT_NAMES.left,
        nameTouched: nameTouched.left,
      },
      right: {
        ...draft.right,
        name: draft.right.name.trim() || DEFAULT_NAMES.right,
        nameTouched: nameTouched.right,
      },
    });
  };

  const resetDemo = () => {
    setDraft(cloneSources(DEMO_SOURCES));
    setNameTouched({ left: false, right: false });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
  };

  const renderPanel = (side: Side) => {
    const doc = draft[side];
    const title = side === 'left' ? 'Оригинал' : 'Изменённый';

    return (
      <div className="adoc-diff__source-panel">
        <div className="adoc-diff__source-heading">
          <Typography variant="subtitle2" component="span">
            {title}
          </Typography>
          <span className="adoc-diff__source-meta">
            {countLines(doc.text)} строк · {doc.text.length} символов
          </span>
        </div>

        <input
          className="adoc-diff__source-name"
          value={doc.name}
          onChange={(event) => {
            setNameTouched((previous) => ({ ...previous, [side]: true }));
            update(side, { name: event.target.value });
          }}
          aria-label={`Название документа: ${title}`}
          placeholder={title}
        />

        <textarea
          ref={side === 'left' ? leftRef : rightRef}
          className="adoc-diff__source-textarea"
          value={doc.text}
          onChange={(event) => update(side, { text: event.target.value })}
          onKeyDown={handleKeyDown}
          aria-label={`AsciiDoc: ${title}`}
          spellCheck={false}
        />
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      className="adoc-diff__source-dialog"
      aria-labelledby="adoc-diff-sources-title"
      sx={{ '& .MuiDialog-paper': { height: '92vh' } }}
    >
      <DialogTitle id="adoc-diff-sources-title">
        Документы для сравнения
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Вставьте или отредактируйте AsciiDoc. Документы сравниваются после
          рендера, поэтому разметка не мешает видеть смысловые изменения.
          Ctrl/⌘ + Enter применяет правки.
        </Typography>

        <div className="adoc-diff__source-grid">
          {renderPanel('left')}
          {renderPanel('right')}
        </div>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={resetDemo}>Вернуть демо</Button>

        <div>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="contained" onClick={apply}>
            Применить
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
}
