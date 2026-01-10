import React, { useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { Loader, Center, Text } from '@mantine/core';
import { useListNavigation } from '../hooks/useListNavigation';

// Windowing configuration
const VISIBLE_BUFFER = 25; // Render ±25 items around selected
const ESTIMATED_ITEM_HEIGHT = 110; // px - approximate height of list item
const SCROLL_PADDING = 15; // Extra padding to ensure borders aren't clipped

// Custom scroll function that adds padding to avoid border clipping
const scrollItemIntoView = (itemRef, containerRef, instant = false) => {
  const item = itemRef.current;
  const container = containerRef.current;
  if (!item || !container) return;

  const itemRect = item.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (itemRect.top < containerRect.top + SCROLL_PADDING) {
    const scrollOffset = itemRect.top - containerRect.top - SCROLL_PADDING;
    if (instant) {
      container.scrollTop += scrollOffset;
    } else {
      container.scrollBy({ top: scrollOffset, behavior: 'smooth' });
    }
  }
  else if (itemRect.bottom > containerRect.bottom - SCROLL_PADDING) {
    const scrollOffset = itemRect.bottom - containerRect.bottom + SCROLL_PADDING;
    if (instant) {
      container.scrollTop += scrollOffset;
    } else {
      container.scrollBy({ top: scrollOffset, behavior: 'smooth' });
    }
  }
};

export const ListView = React.memo(function ListView({
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
}) {
  const selectedItemRef = useRef(null);
  const containerRef = useRef(null);
  const isInitialMount = useRef(true);

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
        scrollItemIntoView(selectedItemRef, containerRef, true);
      }
      isInitialMount.current = false;
    }
  }, [items.length]);

  useEffect(() => {
    if (!isInitialMount.current) {
      scrollItemIntoView(selectedItemRef, containerRef, false);
    }
  }, [selectedIndex]);

  const { visibleItems, topSpacerHeight, bottomSpacerHeight, startIndex } = useMemo(() => {
    if (items.length === 0) {
      return { visibleItems: [], topSpacerHeight: 0, bottomSpacerHeight: 0, startIndex: 0 };
    }

    const start = Math.max(0, selectedIndex - VISIBLE_BUFFER);
    const end = Math.min(items.length - 1, selectedIndex + VISIBLE_BUFFER);

    return {
      visibleItems: items.slice(start, end + 1),
      topSpacerHeight: start * ESTIMATED_ITEM_HEIGHT,
      bottomSpacerHeight: (items.length - 1 - end) * ESTIMATED_ITEM_HEIGHT,
      startIndex: start,
    };
  }, [items, selectedIndex]);

  const handleSelect = useCallback((index) => {
    onSelect(items[index], index);
  }, [items, onSelect]);

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
    return (
      <Center h="100vh">
        <Loader color="#AAF40D" type="dots" size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Text color="red" size="lg">Error: {error}</Text>
      </Center>
    );
  }

  if (items.length === 0) {
    return (
      <div className={className}>
        <div className={`${className}__header`}>
          <h2>{title}</h2>
        </div>
        <Center h="calc(100vh - 200px)" style={{ flexDirection: 'column', gap: '20px' }}>
          {emptyIcon}
          <Text color="dimmed" size="lg">{emptyMessage}</Text>
        </Center>
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
      <div className={`${className}__list`} ref={containerRef}>
        {topSpacerHeight > 0 && (
          <div style={{ height: topSpacerHeight, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 20 }}>
            <Loader color="#AAF40D" type="dots" size="md" />
          </div>
        )}
        {visibleItems.map((item, i) => {
          const actualIndex = startIndex + i;
          return (
            <div
              key={item.guid || item.slug || item.acronym || actualIndex}
              ref={actualIndex === selectedIndex ? selectedItemRef : null}
              className={`${itemClassName} ${actualIndex === selectedIndex ? selectedItemClassName : ''}`}
              onClick={() => onSelect(item, actualIndex)}
            >
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
        {bottomSpacerHeight > 0 && (
          <div style={{ height: bottomSpacerHeight, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 20 }}>
            <Loader color="#AAF40D" type="dots" size="md" />
          </div>
        )}
      </div>
    </div>
  );
});

export default ListView;
