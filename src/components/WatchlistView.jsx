import React, { useState, useEffect, useCallback } from 'react';
import { IconHeartOff } from '@tabler/icons-react';
import { Player } from './Player';
import { ListView } from './ListView';

export const WatchlistView = React.memo(function WatchlistView({ onClose, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }) {
  const [watchlist, setWatchlist] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const loadWatchlist = () => {
      try {
        const stored = localStorage.getItem('watchlist');
        if (stored) {
          setWatchlist(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Error loading watchlist:', err);
      }
    };

    loadWatchlist();

    const handleStorageChange = () => loadWatchlist();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('watchlistUpdate', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchlistUpdate', handleStorageChange);
    };
  }, []);

  const handleSelect = useCallback((item) => {
    setSelectedEvent(item);
    setPlayerIsOpen(true);
    setIsPlayerFullscreen(true);
  }, [setIsPlayerFullscreen]);

  const renderItem = useCallback((event) => (
    <>
      {event.images?.thumbUrl && (
        <img
          src={event.images.thumbUrl}
          alt={event.title}
          className="watchlistView__thumbnail"
          loading="lazy"
        />
      )}
      <div className="watchlistView__info">
        <div className="watchlistView__title">{event.title}</div>
        <div className="watchlistView__meta">
          {event.conference_title && <span>{event.conference_title}</span>}
        </div>
      </div>
    </>
  ), []);

  return (
    <>
      {playerIsOpen && selectedEvent && (
        <div className="player-fullscreen-container">
          <Player
            event={selectedEvent}
            conferenceTitle={selectedEvent.conference_title || ''}
            onClose={() => {
              setPlayerIsOpen(false);
              setSelectedEvent(null);
              setIsPlayerFullscreen(false);
            }}
          />
        </div>
      )}
      <div style={{ display: playerIsOpen ? 'none' : 'block' }}>
        <ListView
          title="Watchlist"
          items={watchlist}
          loading={false}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          onClose={onClose}
          onSelect={handleSelect}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          disabled={playerIsOpen}
          emptyIcon={<IconHeartOff size={120} stroke={1.5} color="#909296" />}
          emptyMessage="Your watchlist is empty"
          renderItem={renderItem}
          className="watchlistView"
          itemClassName="watchlistView__item"
          selectedItemClassName="watchlistView__item--selected"
          countLabel={watchlist.length > 0 ? `${watchlist.length} ${watchlist.length === 1 ? 'video' : 'videos'}` : null}
        />
      </div>
    </>
  );
});

export default WatchlistView;
