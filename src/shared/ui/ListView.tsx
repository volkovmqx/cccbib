import React, { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { LoadingScreen } from './Spinner';
import { isPointerDriven, pointerMoved, useListNavigation } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';

interface ListViewProps<T> {
 title: string; items: T[]; loading?: boolean; error?: string | null; emptyIcon?: React.ReactNode;
 emptyMessage?: string; selectedIndex: number; setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
 onClose: () => void; onSelect: (item: T, index: number) => void; onFocusSidebar: () => void;
 sidebarFocused: boolean; disabled?: boolean; renderItem: (item: T, index: number) => React.ReactNode;
 className?: string; itemClassName?: string; selectedItemClassName?: string; countLabel?: string | null;
}





interface ListRowProps<T> {
  item: T; index: number; selected: boolean; className?: string; selectedClassName?: string;
  selectedRef: React.RefObject<HTMLDivElement | null> | null; renderItem: (item: T, index: number) => React.ReactNode;
  onSelect: (item: T, index: number) => void; onHover: (index: number) => void;
}

// A key press changes the selection of two rows, so the others keep their markup
const ListRow = React.memo(function ListRow<T>({ item, index, selected, className = '', selectedClassName = '', selectedRef, renderItem, onSelect, onHover }: ListRowProps<T>) {
  return (
    <div
      ref={selectedRef}
      className={`listItem ${className} ${selected ? `listItem--selected ${selectedClassName}` : ''}`}
      onClick={() => onSelect(item, index)}
      onMouseMove={(e) => { if (pointerMoved(e)) onHover(index); }}
    >
      {renderItem(item, index)}
    </div>
  );
}) as <T>(props: ListRowProps<T>) => React.ReactElement;

// Only virtualize if more than this many items
const VIRTUALIZATION_THRESHOLD = 150;
const WINDOW_SIZE = 150;
const SHIFT_THRESHOLD = 30;
const ESTIMATED_ITEM_HEIGHT = 120;
const SCROLL_PADDING = 15;

// Custom scroll function that adds padding to avoid border clipping
const scrollItemIntoView = (itemRef: React.RefObject<HTMLElement | null>, containerRef: React.RefObject<HTMLElement | null>) => {
  const item = itemRef.current;
  const container = containerRef.current;
  if (!item || !container) return;

  const itemRect = item.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (itemRect.top < containerRect.top + SCROLL_PADDING) {
    const scrollOffset = itemRect.top - containerRect.top - SCROLL_PADDING;
    container.scrollTop += scrollOffset;
  }
  else if (itemRect.bottom > containerRect.bottom - SCROLL_PADDING) {
    const scrollOffset = itemRect.bottom - containerRect.bottom + SCROLL_PADDING;
    container.scrollTop += scrollOffset;
  }
};

function ListViewComponent<T extends { guid?: string; slug?: string; acronym?: string }>({
  title,
  items,
  loading,
  error,
  emptyIcon,
  emptyMessage,
  selectedIndex,
  setSelectedIndex,
  onClose,
  onSelect,
  onFocusSidebar,
  sidebarFocused,
  disabled = false,
  renderItem,
  className,
  itemClassName,
  selectedItemClassName,
  countLabel,
}: ListViewProps<T>) {
  const t = useTranslation();
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMount = useRef(true);

  const shouldVirtualize = items.length > VIRTUALIZATION_THRESHOLD;

  // Window state for virtualization
  const [windowStart, setWindowStart] = useState(() =>
    Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2))
  );

  // Shift window when selection approaches edges (only if virtualizing)
  useEffect(() => {
    if (!shouldVirtualize || items.length === 0) return;

    const windowEnd = Math.min(windowStart + WINDOW_SIZE - 1, items.length - 1);
    const distanceFromStart = selectedIndex - windowStart;
    const distanceFromEnd = windowEnd - selectedIndex;

    if (distanceFromStart < SHIFT_THRESHOLD && windowStart > 0) {
      const newStart = Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2));
      setWindowStart(newStart);
    } else if (distanceFromEnd < SHIFT_THRESHOLD && windowEnd < items.length - 1) {
      const newStart = Math.max(0, Math.min(
        selectedIndex - Math.floor(WINDOW_SIZE / 2),
        items.length - WINDOW_SIZE
      ));
      setWindowStart(newStart);
    }
  }, [selectedIndex, windowStart, items.length, shouldVirtualize]);

  // Reset window when items change
  useEffect(() => {
    if (shouldVirtualize) {
      setWindowStart(Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2)));
    }
  }, [items, shouldVirtualize]);

  // On initial mount, only scroll if item is not visible
  useLayoutEffect(() => {
    if (isInitialMount.current && selectedItemRef.current && containerRef.current) {
      const item = selectedItemRef.current;
      const container = containerRef.current;
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const isVisible = itemRect.top >= containerRect.top &&
                        itemRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        scrollItemIntoView(selectedItemRef, containerRef);
      }
      isInitialMount.current = false;
    }
  }, [items.length]);

  useEffect(() => {
    if (!isInitialMount.current && !isPointerDriven()) {
      scrollItemIntoView(selectedItemRef, containerRef);
    }
  }, [selectedIndex]);

  // Calculate visible items
  const windowEnd = shouldVirtualize
    ? Math.min(windowStart + WINDOW_SIZE - 1, items.length - 1)
    : items.length - 1;
  const startIndex = shouldVirtualize ? windowStart : 0;
  const visibleItems = shouldVirtualize
    ? items.slice(windowStart, windowEnd + 1)
    : items;
  const topSpacerHeight = shouldVirtualize ? windowStart * ESTIMATED_ITEM_HEIGHT : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, (items.length - 1 - windowEnd)) * ESTIMATED_ITEM_HEIGHT
    : 0;

  const handleSelect = useCallback((index: number) => {
    onSelect(items[index], index);
  }, [items, onSelect]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectItem = useCallback((item: T, index: number) => onSelectRef.current(item, index), []);

  useListNavigation({
    itemCount: items.length,
    selectedIndex,
    setSelectedIndex,
    onClose,
    onSelect: handleSelect,
    onFocusSidebar,
    sidebarFocused,
    disabled,
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="center" style={{ height: '100vh' }}>
        <p className="errorText">{t('Error: {message}', { message: error })}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={className}>
        <div className={`${className}__header`}>
          <h2>{title}</h2>
        </div>
        <div className="center emptyState">
          {emptyIcon}
          <p className="mutedText">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`${className}__header`}>
        <h2>{title}</h2>
        {countLabel && (
          <p className={`${className}__count`}>{countLabel}</p>
        )}
      </div>
      <div className={`${className}__list scrollable`} ref={containerRef} data-wheel="scroll" data-wheel-main>
        {topSpacerHeight > 0 && (
          <div style={{ height: topSpacerHeight }} aria-hidden="true" />
        )}
        {visibleItems.map((item, i) => {
          const actualIndex = startIndex + i;
          return (
            <ListRow
              key={item.guid || item.slug || item.acronym || actualIndex}
              item={item}
              index={actualIndex}
              selected={actualIndex === selectedIndex}
              className={itemClassName}
              selectedClassName={selectedItemClassName}
              selectedRef={actualIndex === selectedIndex ? selectedItemRef : null}
              renderItem={renderItem}
              onSelect={selectItem}
              onHover={setSelectedIndex}
            />
          );
        })}
        {bottomSpacerHeight > 0 && (
          <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

export const ListView = React.memo(ListViewComponent) as typeof ListViewComponent;

