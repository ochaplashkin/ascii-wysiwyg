import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
} from '../model/sidebar-layout.js';

export interface SidebarResizerProps {
  width: number;
  /** Called continuously while dragging (already rAF-throttled). */
  onChange: (width: number) => void;
  /** Called on pointer release and on every keyboard step. */
  onCommit: (width: number) => void;
}

const KEYBOARD_STEP = 16;

/**
 * Vertical splitter on the right edge of the sidebar. Pointer drags are
 * throttled with `requestAnimationFrame` and persisted only on release;
 * arrow keys, Home and End resize it without a mouse.
 */
export function SidebarResizer({
  width,
  onChange,
  onCommit,
}: SidebarResizerProps) {
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    pointerId: number;
    latest: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const cancelFrame = () => {
    if (frameRef.current === null) return;
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  };

  useEffect(
    () => () => {
      cancelFrame();
      document.body.classList.remove('is-resizing-sidebar');
    },
    [],
  );

  const scheduleWidth = (next: number) => {
    pendingRef.current = next;

    if (frameRef.current !== null) return;

    if (typeof requestAnimationFrame !== 'function') {
      pendingRef.current = null;
      onChange(next);
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const value = pendingRef.current;
      pendingRef.current = null;
      if (value !== null) onChange(value);
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = null;
    const value = pendingRef.current ?? drag.latest;
    pendingRef.current = null;
    cancelFrame();
    onChange(value);
    onCommit(value);
    document.body.classList.remove('is-resizing-sidebar');
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startWidth: width,
      pointerId: event.pointerId,
      latest: width,
    };

    const target = event.currentTarget;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail in embedded frames; drag still works.
      }
    }

    document.body.classList.add('is-resizing-sidebar');
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const next = clampSidebarWidth(
      drag.startWidth + (event.clientX - drag.startX),
    );
    drag.latest = next;
    scheduleWidth(next);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const target = event.currentTarget;
    if (typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        // The capture may already be gone.
      }
    }

    endDrag();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = width - KEYBOARD_STEP;
        break;
      case 'ArrowRight':
        next = width + KEYBOARD_STEP;
        break;
      case 'Home':
        next = SIDEBAR_MIN_WIDTH;
        break;
      case 'End':
        next = SIDEBAR_MAX_WIDTH;
        break;
      default:
        return;
    }

    event.preventDefault();
    const clamped = clampSidebarWidth(next);
    onChange(clamped);
    onCommit(clamped);
  };

  return (
    <div
      className="ws-sidebar__resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ширина панели файлов"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  );
}
