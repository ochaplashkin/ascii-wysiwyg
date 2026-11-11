import { Icon } from '../../../shared/ui/icons.js';
import type { PreviewState } from '../model/usePreview.js';

const MAX_VISIBLE_WARNINGS = 4;

export interface PreviewPaneProps {
  state: PreviewState;
  /** True when the source references files that the browser cannot resolve. */
  hasLocalResources: boolean;
}

/** Sanitized Asciidoctor output with warnings and errors. */
export function PreviewPane({ state, hasLocalResources }: PreviewPaneProps) {
  const { html, warnings, loading, error } = state;
  const visibleWarnings = warnings.slice(0, MAX_VISIBLE_WARNINGS);

  return (
    <article
      className="se-pane se-pane--preview se-preview"
      aria-label="Предпросмотр AsciiDoc"
    >
      <div className="se-pane-head">
        <span className="se-pane-head__title">Предпросмотр</span>
        {loading ? <span className="ws-spinner" aria-hidden="true" /> : null}
      </div>

      <div className="se-preview__scroll">
        {error ? (
          <div className="se-message se-message--error" role="alert">
            <Icon name="warning" size={16} />
            <div>
              <strong>Не удалось построить предпросмотр</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : html.length > 0 ? (
          <div
            className="adoc-rendered"
            // Asciidoctor output is sanitized by `sanitizeHtml` before it gets
            // here (scripts, event handlers and dangerous protocols removed).
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : loading ? (
          <div className="se-message">Рендерим документ…</div>
        ) : (
          <div className="se-message">
            В документе пока нет содержимого для предпросмотра.
          </div>
        )}

        {warnings.length > 0 ? (
          <div className="se-warnings" role="status">
            <strong>Сообщения Asciidoctor</strong>
            <ul>
              {visibleWarnings.map((warning, index) => (
                <li key={`${warning.line ?? 'x'}-${index}`}>
                  {warning.severity}: {warning.text}
                  {warning.line ? ` (строка ${warning.line})` : ''}
                </li>
              ))}
            </ul>
            {warnings.length > MAX_VISIBLE_WARNINGS ? (
              <span className="se-warnings__more">
                …и ещё {warnings.length - MAX_VISIBLE_WARNINGS}
              </span>
            ) : null}
          </div>
        ) : null}

        {hasLocalResources ? (
          <p className="se-note">
            В документе есть <code>include::</code> или <code>image::</code>.
            Браузер не читает соседние файлы папки, поэтому такие вставки
            могут не отобразиться.
          </p>
        ) : null}
      </div>
    </article>
  );
}
