import { useState, useEffect, useRef } from 'react';
import { useWindowEvent } from '@/shared/lib';
import { NavIcon, isFilled } from '@/shared/ui';
import { CatIcon } from '@/shared/ui';
import { Logo } from '@/shared/ui';
import { useSetting } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

interface MenuItem { id: string; label: string; brand?: boolean; bottom?: boolean }








export const Sidebar = ({ selectedItem, onSelectItem, focused }: { selectedItem: string; onSelectItem: (id: string) => void; focused: boolean }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const t = useTranslation();
  const [settingsEntry] = useSetting('settingsEntry');
  const [iconVariant] = useSetting('iconVariant');
  const logoEntry = settingsEntry === 'logo';

  const menuItems: MenuItem[] = [
    { id: 'recent', label: t('Home') },
    { id: 'search', label: t('Search') },
    { id: 'popular', label: t('Popular') },
    { id: 'events', label: t('Events') },
    { id: 'watchlist', label: t('Watchlist') },
  ];
  if (logoEntry) menuItems.unshift({ id: 'settings', brand: true, label: t('Settings') });
  else menuItems.push({ id: 'settings', bottom: true, label: t('Settings') });

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
        block: 'nearest'
      });
    }
  }, [selectedIndex, focused]);

  // Switching right away would let the view react to this same keypress (Enter would start playback)
  const selectAfterKeypress = (id: string) => setTimeout(() => onSelectItem(id), 0);

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
      selectAfterKeypress(selectedItem);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectAfterKeypress(menuItems[selectedIndex].id);
    }
  });

  const renderItem = (item: MenuItem) => {
    const index = menuItems.indexOf(item);
    const isSelected = selectedItem === item.id || (item.id === 'events' && selectedItem !== 'search' && selectedItem !== 'popular' && selectedItem !== 'recent' && selectedItem !== 'settings' && selectedItem !== 'watchlist');
    const isHighlighted = selectedIndex === index && focused;

    return (
      <div
        key={item.id}
        ref={selectedIndex === index ? selectedItemRef : null}
        className={`sidebarItem ${isSelected ? 'sidebarItem--selected' : ''} ${isHighlighted ? 'sidebarItem--highlighted' : ''} ${item.bottom ? 'sidebarItem--bottom' : ''} ${item.brand ? 'sidebarItem--brand' : ''}`}
        onClick={() => onSelectItem(item.id)}
      >
        <div className={`sidebarItem__icon ${isSelected ? 'sidebarItem__icon--active' : ''}`}>
          {item.brand ? <CatIcon /> : <NavIcon name={item.id} size={36} filled={isFilled(iconVariant, isSelected || isHighlighted)} />}
        </div>
        {item.brand ? (
          <span className="sidebarItem__label sidebarItem__brandLabel" aria-label={item.label}><Logo /></span>
        ) : (
          <span className="sidebarItem__label">{item.label}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`sidebar ${focused ? 'sidebar--focused' : ''}`} ref={containerRef}>
      {!logoEntry && (
        <div className="sidebar__brand" aria-hidden="true">
          <span className="sidebar__mark"><CatIcon /></span>
          <span className="sidebar__wordmark"><Logo /></span>
        </div>
      )}
      {menuItems.filter((item) => item.brand).map(renderItem)}
      <div className="sidebar__main">
        {menuItems.filter((item) => !item.brand && !item.bottom).map(renderItem)}
      </div>
      {menuItems.filter((item) => item.bottom).map(renderItem)}
    </div>
  );
};
