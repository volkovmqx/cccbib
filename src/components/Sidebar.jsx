import React, { useState, useEffect, useRef } from 'react';
import { useWindowEvent } from '@mantine/hooks';
import { IconSearch, IconTrendingUp, IconHome, IconLayoutGrid, IconSettings, IconBookmark } from '@tabler/icons-react';

export const Sidebar = ({ selectedItem, onSelectItem, focused }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItemRef = useRef(null);
  const containerRef = useRef(null);

  // Menu items (Search, Home/Recent, Popular, Events, Watchlist, Settings)
  const menuItems = [
    { id: 'search', icon: <IconSearch size={36} />, label: 'Search' },
    { id: 'recent', icon: <IconHome size={36} />, label: 'Home' },
    { id: 'popular', icon: <IconTrendingUp size={36} />, label: 'Popular' },
    { id: 'events', icon: <IconLayoutGrid size={36} />, label: 'Events' },
    { id: 'watchlist', icon: <IconBookmark size={36} />, label: 'Watchlist' },
    { id: 'settings', icon: <IconSettings size={36} />, label: 'Settings' },
  ];

  // Calculate which item is selected based on selectedItem prop
  useEffect(() => {
    const index = menuItems.findIndex(item => item.id === selectedItem);
    if (index !== -1) {
      setSelectedIndex(index);
    } else {
      // If selectedItem is a conference slug, highlight Events
      const eventsIndex = menuItems.findIndex(item => item.id === 'events');
      setSelectedIndex(eventsIndex);
    }
  }, [selectedItem]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && containerRef.current && focused) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex, focused]);

  // Keyboard navigation (only when focused)
  useWindowEvent('keydown', (e) => {
    if (!focused) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % menuItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Just unfocus sidebar and return to current view (don't change selectedItem)
      // The parent will handle unfocusing via the onSelectItem callback
      // Pass the current selectedItem to keep the same view
      onSelectItem(selectedItem);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItemData = menuItems[selectedIndex];
      onSelectItem(selectedItemData.id);
    }
  });

  return (
    <div className={`sidebar ${focused ? 'sidebar--focused' : ''}`} ref={containerRef}>
      {/* Menu Items */}
      {menuItems.map((item, index) => {
        const isSelected = selectedItem === item.id || (item.id === 'events' && selectedItem !== 'search' && selectedItem !== 'popular' && selectedItem !== 'recent' && selectedItem !== 'settings' && selectedItem !== 'watchlist');
        const isHighlighted = selectedIndex === index && focused;

        return (
          <div
            key={item.id}
            ref={selectedIndex === index ? selectedItemRef : null}
            className={`sidebarItem ${isSelected ? 'sidebarItem--selected' : ''} ${isHighlighted ? 'sidebarItem--highlighted' : ''}`}
            onClick={() => onSelectItem(item.id)}
          >
            <div className={`sidebarItem__icon ${isSelected ? 'sidebarItem__icon--active' : ''}`}>
              {item.icon}
            </div>
          </div>
        );
      })}
    </div>
  );
};
