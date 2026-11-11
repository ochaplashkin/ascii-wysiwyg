import { Icon } from '../../../shared/ui/icons.js';
import { krokiPageUrl } from '../model/kroki-url.js';
import {
  useKrokiHealth,
  type KrokiHealthStatus,
} from '../model/useKrokiHealth.js';

const STATUS_LABEL: Record<KrokiHealthStatus, string> = {
  unknown: 'статус неизвестен',
  checking: 'проверяем соединение…',
  ok: 'доступен',
  error: 'недоступен',
};

export interface KrokiLinkButtonProps {
  /** Kroki base URL (e.g. `/kroki`) or `null` to hide the affordance. */
  url: string | null;
}

/**
 * Status-bar link to the self-hosted Kroki services page.
 *
 * It is a plain `<a>` (not a button with `window.open`) so the browser's
 * normal link semantics apply: middle-click, "open in new tab" and keyboard
 * activation all work. The health dot never disables the link — Kroki may be
 * starting, and the services page is still a useful diagnostic target.
 */
export function KrokiLinkButton({ url }: KrokiLinkButtonProps) {
  const { status } = useKrokiHealth(url);

  if (!url) return null;

  const pageUrl = krokiPageUrl(url);
  const statusLabel = STATUS_LABEL[status];

  return (
    <a
      className={`se-kroki-link is-${status}`}
      href={pageUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Открыть сервис Kroki в новой вкладке"
      title={`Открыть сервис Kroki: ${pageUrl}\nСтатус: ${statusLabel}`}
      data-health={status}
    >
      <Icon name="link" size={13} />
      <span className="se-kroki-link__label">Kroki</span>
      <span
        className="se-kroki-link__dot"
        aria-hidden="true"
        data-health={status}
      />
    </a>
  );
}
