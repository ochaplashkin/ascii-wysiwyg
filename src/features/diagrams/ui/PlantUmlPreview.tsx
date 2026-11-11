import { Icon } from '../../../shared/ui/icons.js';
import { usePlantUmlPreview } from '../model/usePlantUmlPreview.js';

export interface PlantUmlPreviewProps {
  source: string;
  url: string | null;
  /** False while the source pane is active on a narrow screen. */
  enabled?: boolean;
}

/**
 * Right-hand pane of the `.puml` editor: the source is edited on the left and
 * rendered through Kroki here.
 */
export function PlantUmlPreview({
  source,
  url,
  enabled = true,
}: PlantUmlPreviewProps) {
  const state = usePlantUmlPreview(source, url, 'svg', enabled);

  return (
    <section
      className="se-pane se-pane--preview se-preview se-puml"
      aria-label="Предпросмотр PlantUML"
      aria-busy={state.status === 'loading'}
    >
      <div className="se-pane-head">
        <span className="se-pane-head__title">Диаграмма</span>
        <span className="se-pane-head__hint">
          {state.status === 'loading' ? (
            <>
              <span className="ws-spinner" aria-hidden="true" /> Рендерим…
            </>
          ) : (
            'PlantUML · Kroki'
          )}
        </span>
      </div>

      <div className="se-preview__scroll se-puml__scroll">
        {state.dataUrl ? (
          <div className="se-puml__canvas">
            <img
              className="se-puml__image"
              src={state.dataUrl}
              alt="PlantUML-диаграмма"
            />
          </div>
        ) : state.status === 'error' ? (
          <div className="se-message se-message--error" role="alert">
            <Icon name="warning" size={16} />
            <div>
              <strong>Не удалось отрисовать диаграмму</strong>
              <p>{state.error}</p>
              <p className="se-puml__hint">
                Проверьте, что сервис Kroki запущен и{' '}
                <code>VITE_KROKI_URL</code> указывает на него.
              </p>
            </div>
          </div>
        ) : state.status === 'loading' ? (
          <div className="se-message">Рендерим диаграмму…</div>
        ) : (
          <div className="se-message">
            Начните вводить PlantUML — диаграмма появится здесь.
          </div>
        )}
      </div>
    </section>
  );
}
