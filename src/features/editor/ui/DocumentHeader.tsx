import type { RefObject } from 'react';

export interface DocumentHeaderProps {
  title: string;
  onChange: (title: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Breadcrumb and the Confluence-style document title field. */
export function DocumentHeader({
  title,
  onChange,
  inputRef,
}: DocumentHeaderProps) {
  const displayTitle = title.trim().length > 0 ? title : 'Без названия';

  return (
    <header className="document-header">
      <nav className="document-breadcrumb" aria-label="Путь к документу">
        <span>Документы</span>
        <span aria-hidden="true">/</span>
        <span className="document-breadcrumb__current">{displayTitle}</span>
      </nav>
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
    </header>
  );
}
