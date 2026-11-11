export type EditorMode = 'source' | 'visual';

export interface ViewSwitchProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}

/** Segmented "Исходник | Визуально" mode switch. */
export function ViewSwitch({ mode, onChange }: ViewSwitchProps) {
  return (
    <div className="se-viewswitch" role="group" aria-label="Режим редактора">
      <button
        type="button"
        className={`se-viewswitch__button${mode === 'source' ? ' is-active' : ''}`}
        aria-pressed={mode === 'source'}
        onClick={() => onChange('source')}
        title="Редактировать AsciiDoc-исходник (Ctrl/Cmd + /)"
      >
        Исходник
      </button>
      <button
        type="button"
        className={`se-viewswitch__button${mode === 'visual' ? ' is-active' : ''}`}
        aria-pressed={mode === 'visual'}
        onClick={() => onChange('visual')}
        title="Визуальный режим (Ctrl/Cmd + /)"
      >
        Визуально
      </button>
    </div>
  );
}
