import type { ButtonHTMLAttributes } from 'react';

import { Icon, type IconName } from './icons.js';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  label: string;
  active?: boolean;
  shortcut?: string;
  compact?: boolean;
};

export function IconButton({
  icon,
  label,
  active = false,
  shortcut,
  compact = false,
  className = '',
  onMouseDown,
  ...rest
}: IconButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      className={[
        'editor-icon-button',
        active ? 'is-active' : '',
        compact ? 'is-compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-pressed={active || undefined}
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown?.(event);
      }}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

export function ToolbarDivider() {
  return <span className="editor-toolbar__divider" aria-hidden="true" />;
}
