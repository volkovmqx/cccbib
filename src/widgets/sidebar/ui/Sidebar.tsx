import { useState, useEffect, useRef } from 'react';
import { pointerMoved, useMediaQuery, useWindowEvent } from '@/shared/lib';
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
  const [chosenLogoButton] = useSetting('logoButton');
  const compact = useMediaQuery('(max-width: 900px)');
  const logoButton = chosenLogoButton === 'off' && compact ? 'home' : chosenLogoButton;
  const [iconVariant] = useSetting('iconVariant');
  const logoEntry = logoButton !== 'off';

  const menuItems: MenuItem[] = [
    { id: 'recent', label: t('Home') },
    { id: 'search', label: t('Search') },
    { id: 'popular', label: t('Popular') },
    { id: 'events', label: t('Events') },
    { id: 'watchlist', label: t('Watchlist') },
  ];
  if (logoButton === 'home') menuItems[0] = { id: 'recent', brand: true, label: t('Home') };
  if (logoButton === 'settings') menuItems.unshift({ id: 'settings', brand: true, label: t('Settings') });
  else menuItems.push({ id: 'settings', bottom: true, label: t('Settings') });

  // Calculate which item is selected based on selectedItem prop
  const syncSelectedIndex = () => {
    const index = menuItems.findIndex(item => item.id === selectedItem);
    if (index !== -1) {
      setSelectedIndex(index);
    } else {
      // If selectedItem is a conference slug, highlight Events
      const eventsIndex = menuItems.findIndex(item => item.id === 'events');
      setSelectedIndex(eventsIndex);
    }
  };
  useEffect(syncSelectedIndex, [selectedItem]);

  useEffect(() => {
    if (!focused) syncSelectedIndex();
  }, [focused]);

  useEffect(() => {
    const bar = containerRef.current;
    const item = selectedItemRef.current;
    if (!bar || !item || !focused) return;
    const view = bar.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    if (box.top < view.top) bar.scrollTop -= view.top - box.top;
    else if (box.bottom > view.bottom) bar.scrollTop += box.bottom - view.bottom;
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
        data-screen={item.id}
        ref={selectedIndex === index ? selectedItemRef : null}
        className={`sidebarItem ${isSelected ? 'sidebarItem--selected' : ''} ${isHighlighted ? 'sidebarItem--highlighted' : ''} ${item.bottom ? 'sidebarItem--bottom' : ''} ${item.brand ? 'sidebarItem--brand' : ''}`}
        onClick={() => onSelectItem(item.id)}
        onMouseMove={(e) => { if (pointerMoved(e)) setSelectedIndex(index); }}
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
    <div className={`sidebar ${focused && !compact ? 'sidebar--focused' : ''}`} ref={containerRef}>
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
