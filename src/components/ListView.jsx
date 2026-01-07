import React, { useRef, useCallback } from 'react';
import { Loader, Center, Text } from '@mantine/core';
import { useScrollIntoView } from '../helpers/scrollHelpers';
import { useListNavigation } from '../hooks/useListNavigation';

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

  useScrollIntoView(selectedItemRef, containerRef, selectedIndex);

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
        {items.map((item, index) => (
          <div
            key={item.guid || item.slug || item.acronym || index}
            ref={index === selectedIndex ? selectedItemRef : null}
            className={`${itemClassName} ${index === selectedIndex ? selectedItemClassName : ''}`}
            onClick={() => onSelect(item, index)}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
});

export default ListView;
