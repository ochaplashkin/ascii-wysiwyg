import { useMemo } from 'react';

import { Icon } from '../../../shared/ui/icons.js';
import { lineDiff } from '../model/line-diff.js';

const MAX_DIFF_ROWS = 400;

export interface NormalizationPanelProps {
  baseline: string;
  source: string;
  onKeep: () => void;
  onBackToVisual: () => void;
  onDiscard: () => void;
}

/**
 * Shown after leaving the visual mode with edits: the serializer rebuilt the
 * whole source, so the user sees exactly what changed and can accept, return
 * to WYSIWYG or discard the visual edits.
 */
export function NormalizationPanel({
  baseline,
  source,
  onKeep,
  onBackToVisual,
  onDiscard,
}: NormalizationPanelProps) {
  const diff = useMemo(() => lineDiff(baseline, source), [baseline, source]);
  const visible = diff.rows.slice(0, MAX_DIFF_ROWS);

  return (
    <section
      className="se-normalization"
      aria-labelledby="normalization-title"
      role="region"
    >
      <div className="se-normalization__head">
        <span className="se-normalization__icon" aria-hidden="true">
          <Icon name="warning" size={18} />
        </span>
        <div className="se-normalization__text">
          <h2 id="normalization-title" className="se-normalization__title">
            Разметка нормализована
          </h2>
          <p>
            Визуальный режим хранит структуру, а не исходный синтаксис, поэтому
            при выходе AsciiDoc пересобран сериализатором. Содержимое
            сохранено, но написание разметки могло измениться.
          </p>
        </div>
        <span className="se-normalization__stats">
          +{diff.added} / −{diff.removed}
        </span>
      </div>

      <div className="se-normalization__actions">
        <button
          type="button"
          className="se-button se-button--primary"
          onClick={onKeep}
        >
          Оставить
        </button>
        <button
          type="button"
          className="se-button"
          onClick={onBackToVisual}
        >
          Вернуться в визуальный режим
        </button>
        <button
          type="button"
          className="se-button se-button--danger"
          onClick={onDiscard}
        >
          Отменить визуальные правки
        </button>
      </div>

      <div
        className="se-normalization__diff"
        aria-label="Различия до и после нормализации"
      >
        {visible.map((row, index) => (
          <div
            key={`${row.kind}-${index}`}
            className={`se-diffrow is-${row.kind}`}
          >
            <span className="se-diffrow__number">{row.leftNumber ?? ''}</span>
            <span className="se-diffrow__number">{row.rightNumber ?? ''}</span>
            <span className="se-diffrow__sign" aria-hidden="true">
              {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}
            </span>
            <span className="se-diffrow__text">{row.text || ' '}</span>
          </div>
        ))}
      </div>

      {diff.rows.length > MAX_DIFF_ROWS ? (
        <p className="se-note">
          Показаны первые {MAX_DIFF_ROWS} строк из {diff.rows.length}.
        </p>
      ) : null}
    </section>
  );
}
