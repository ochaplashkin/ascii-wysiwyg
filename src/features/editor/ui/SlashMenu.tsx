import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Editor, Range } from '@tiptap/core';

import type { IconName } from './icons.js';
import { Icon, SearchIcon } from './icons.js';

export interface SlashItem {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  query: string;
}

/** Keyboard-navigable block inserter rendered inside tippy.js. */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashMenu({ items, command, query }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const safeIndex = items.length > 0 ? selectedIndex % items.length : 0;

    useEffect(() => {
      setSelectedIndex(0);
    }, [items, query]);

    useEffect(() => {
      const selected = listRef.current?.querySelector<HTMLElement>(
        '[data-selected="true"]',
      );
      selected?.scrollIntoView({ block: 'nearest' });
    }, [safeIndex]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    const handleKeyDown = useMemo(
      () => (props: { event: KeyboardEvent }) => {
        const { event } = props;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (items.length > 0) {
            setSelectedIndex((current) => (current + 1) % items.length);
          }
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (items.length > 0) {
            setSelectedIndex(
              (current) => (current - 1 + items.length) % items.length,
            );
          }
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          selectItem(safeIndex);
          return true;
        }

        return false;
      },
      [items, safeIndex],
    );

    useImperativeHandle(ref, () => ({ onKeyDown: handleKeyDown }), [
      handleKeyDown,
    ]);

    return (
      <div
        className="editor-slash-menu"
        role="listbox"
        aria-label="Вставить блок"
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="editor-slash-menu__header">
          <SearchIcon />
          <span>{query.length > 0 ? `Поиск: ${query}` : 'Вставить блок'}</span>
        </div>
        <div className="editor-slash-menu__list" ref={listRef}>
          {items.length === 0 && (
            <p className="editor-slash-menu__empty">Ничего не найдено</p>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === safeIndex}
              data-selected={index === safeIndex ? 'true' : 'false'}
              className={[
                'editor-slash-menu__item',
                index === safeIndex ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
            >
              <span className="editor-slash-menu__icon">
                <Icon name={item.icon} />
              </span>
              <span className="editor-slash-menu__text">
                <span className="editor-slash-menu__title">{item.title}</span>
                <span className="editor-slash-menu__description">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="editor-slash-menu__hint">
          <kbd>↑</kbd>
          <kbd>↓</kbd> выбор · <kbd>Enter</kbd> вставить · <kbd>Esc</kbd> закрыть
        </div>
      </div>
    );
  },
);
