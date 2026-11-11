import type { RefObject } from 'react';

export interface DocumentHeaderProps {
  title: string;
  onChange: (title: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Editable document title. It becomes the leading `= Title` in AsciiDoc. */
export function DocumentHeader({
  title,
  onChange,
  inputRef,
}: DocumentHeaderProps) {
  return (
    <div className="document-title-row">
      <input
        ref={inputRef}
        className="document-title"
        value={title}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Без названия"
        aria-label="Название документа"
        spellCheck={false}
      />
    </div>
  );
}
