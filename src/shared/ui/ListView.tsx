import React, { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { LoadingScreen } from './Spinner';
import { isPointerDriven, pointerMoved, useListNavigation } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';

// near turns true once the row is within reach of the list's view, Chrome 68 loads every loading="lazy" image at once
type RenderItem<T> = (item: T, index: number, near: boolean) => React.ReactNode;
type Watch = (row: Element, onNear: () => void) => (() => void) | undefined;

interface ListViewProps<T> {
 title: string; items: T[]; loading?: boolean; error?: string | null; emptyIcon?: React.ReactNode;
 emptyMessage?: string; selectedIndex: number; setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
 onClose: () => void; onSelect: (item: T, index: number) => void; onFocusSidebar: () => void;
 sidebarFocused: boolean; disabled?: boolean; renderItem: RenderItem<T>;
 className?: string; itemClassName?: string; selectedItemClassName?: string; countLabel?: string | null;
}

interface ListRowProps<T> {
  item: T; index: number; selected: boolean; className?: string; selectedClassName?: string;
  selectedRef: React.RefObject<HTMLDivElement | null> | null; renderItem: RenderItem<T>; watch?: Watch;
  onSelect: (item: T, index: number) => void; onHover: (index: number) => void;
}

// A key press changes the selection of two rows, so the others keep their markup
const ListRow = React.memo(function ListRow<T>({ item, index, selected, className = '', selectedClassName = '', selectedRef, renderItem, watch, onSelect, onHover }: ListRowProps<T>) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(!watch);
  useEffect(() => (near || !watch || !rowRef.current ? undefined : watch(rowRef.current, () => setNear(true))), [near, watch]);
  const setRef = useCallback((node: HTMLDivElement | null) => {
    rowRef.current = node;
    if (selectedRef) selectedRef.current = node;
  }, [selectedRef]);
  return (
    <div
      ref={setRef}
      className={`listItem ${className} ${selected ? `listItem--selected ${selectedClassName}` : ''}`}
      onClick={() => onSelect(item, index)}
      onMouseMove={(e) => { if (pointerMoved(e)) onHover(index); }}
    >
      {renderItem(item, index, near)}
    </div>
  );
}) as <T>(props: ListRowProps<T>) => React.ReactElement;

// Only virtualize if more than this many items
const VIRTUALIZATION_THRESHOLD = 150;
const WINDOW_SIZE = 150;
const SHIFT_THRESHOLD = 30;
const ESTIMATED_ITEM_HEIGHT = 120;
const MIN_ITEM_HEIGHT = 20;
const SCROLL_PADDING = 15;
const LOOKAHEAD_PX = 800;

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

  const nearRows = useRef(new Map<Element, () => void>());
  const observer = useRef<{ root: Element; io: IntersectionObserver } | null>(null);
  const watch = useMemo<Watch | undefined>(() => (typeof IntersectionObserver === 'undefined' ? undefined : (row, onNear) => {
    const root = containerRef.current;
    if (!root) return undefined;
    if (!observer.current || observer.current.root !== root) {
      if (observer.current) observer.current.io.disconnect();
      const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
        const reached = entry.isIntersecting ? nearRows.current.get(entry.target) : undefined;
        if (!reached) return;
        nearRows.current.delete(entry.target);
        io.unobserve(entry.target);
        reached();
      }), { root, rootMargin: `${LOOKAHEAD_PX}px 0px` });
      observer.current = { root, io };
    }
    const { io } = observer.current;
    nearRows.current.set(row, onNear);
    io.observe(row);
    return () => { nearRows.current.delete(row); io.unobserve(row); };
  }), []);
  useEffect(() => () => { if (observer.current) observer.current.io.disconnect(); }, []);

  const shouldVirtualize = items.length > VIRTUALIZATION_THRESHOLD;

  // The spacers stand for the rows that are not built, they use the height the rows really have so that moving the window does not move the list
  const [rowHeight, setRowHeight] = useState(ESTIMATED_ITEM_HEIGHT);
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;

  // Window state for virtualization
  const [windowStart, setWindowStart] = useState(() =>
    Math.max(0, selectedIndex - Math.floor(WINDOW_SIZE / 2))
  );
  const windowStartRef = useRef(windowStart);
  windowStartRef.current = windowStart;
  const alignSelection = useRef(false);

  // Where the window goes for an index, null while the index is well inside it
  const windowAround = (index: number) => {
    const start = windowStartRef.current;
    const end = Math.min(start + WINDOW_SIZE - 1, items.length - 1);
    if (index - start < SHIFT_THRESHOLD && start > 0) return Math.max(0, index - Math.floor(WINDOW_SIZE / 2));
    if (end - index < SHIFT_THRESHOLD && end < items.length - 1) return Math.max(0, Math.min(index - Math.floor(WINDOW_SIZE / 2), items.length - WINDOW_SIZE));
    return null;
  };

  // Shift window when selection approaches edges (only if virtualizing)
  useEffect(() => {
    if (!shouldVirtualize || items.length === 0) return;
    const next = windowAround(selectedIndex);
    if (next === null) return;
    alignSelection.current = true;
    setWindowStart(next);
  }, [selectedIndex, items.length, shouldVirtualize]);

  // Touch, the scrollbar and the wheel move the list without the selection, the window follows what is on screen
  const followScroll = () => {
    const container = containerRef.current;
    if (!shouldVirtualize || !container) return;
    const middle = Math.floor((container.scrollTop + container.clientHeight / 2) / rowHeightRef.current);
    const next = windowAround(Math.min(items.length - 1, Math.max(0, middle)));
    if (next !== null) setWindowStart(next);
  };

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

  // A jump across the list (up on the first row, down on the last) moves the window after the key press, the selected row only exists from that render on
  useLayoutEffect(() => {
    if (!alignSelection.current) return;
    alignSelection.current = false;
    if (!isPointerDriven()) scrollItemIntoView(selectedItemRef, containerRef);
  }, [windowStart, rowHeight]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!shouldVirtualize || !container) return;
    const rows = container.querySelectorAll<HTMLElement>('.listItem');
    const pitch = (rows[rows.length - 1].offsetTop - rows[0].offsetTop) / (rows.length - 1);
    if (!(pitch >= MIN_ITEM_HEIGHT) || Math.abs(pitch - rowHeightRef.current) <= 1) return;
    alignSelection.current = true;
    setRowHeight(pitch);
  }, [windowStart, items.length, shouldVirtualize]);

  // Calculate visible items
  const windowEnd = shouldVirtualize
    ? Math.min(windowStart + WINDOW_SIZE - 1, items.length - 1)
    : items.length - 1;
  const startIndex = shouldVirtualize ? windowStart : 0;
  const visibleItems = shouldVirtualize
    ? items.slice(windowStart, windowEnd + 1)
    : items;
  const topSpacerHeight = shouldVirtualize ? windowStart * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, (items.length - 1 - windowEnd)) * rowHeight
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
      <div className={`${className}__list scrollable`} ref={containerRef} onScroll={followScroll} data-wheel="scroll" data-wheel-main>
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
              watch={watch}
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

