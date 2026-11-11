import type { RefObject } from 'react';

import { Icon } from '../../../shared/ui/icons.js';

export interface SidebarRailProps {
  onExpand: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

/** Narrow rail shown instead of the collapsed sidebar (desktop only). */
export function SidebarRail({ onExpand, buttonRef }: SidebarRailProps) {
  return (
    <div className="ws-rail">
      <span className="ws-rail__mark" aria-hidden="true">
        A
      </span>
      <button
        ref={buttonRef}
        type="button"
        className="ws-rail__button"
        onClick={onExpand}
        aria-label="Показать панель файлов"
        aria-controls="workspace-sidebar"
        aria-expanded={false}
        title="Показать панель файлов"
      >
        <Icon name="sidebarExpand" size={18} />
      </button>
    </div>
  );
}
