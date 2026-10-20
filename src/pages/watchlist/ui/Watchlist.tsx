import type { Talk } from '@/entities/talk';
import type { PlaybackPageProps } from '@/shared/ui';
import React, { useState, useEffect, useCallback } from 'react';
import { IconHeartOff } from '@tabler/icons-react';
import { Player } from '@/widgets/player';
import { ListView } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { readWatchlist } from '@/features/watchlist';

const WatchlistView = React.memo(function WatchlistView({ onClose, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }: PlaybackPageProps) {
  const t = useTranslation();
  const [watchlist, setWatchlist] = useState<Talk[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Talk | null>(null);

  useEffect(() => {
    const loadWatchlist = () => setWatchlist(readWatchlist());

    loadWatchlist();

    window.addEventListener('storage', loadWatchlist);
    window.addEventListener('watchlistUpdate', loadWatchlist);

    return () => {
      window.removeEventListener('storage', loadWatchlist);
      window.removeEventListener('watchlistUpdate', loadWatchlist);
    };
  }, []);

  const handleSelect = useCallback((item: Talk) => {
    setSelectedEvent(item);
    setPlayerIsOpen(true);
    setIsPlayerFullscreen(true);
  }, [setIsPlayerFullscreen]);

  const renderItem = useCallback((event: Talk) => (
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
          title={t('Watchlist')}
          items={watchlist}
          loading={false}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          onClose={onClose}
          onSelect={handleSelect}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          disabled={playerIsOpen}
          emptyIcon={<IconHeartOff size={120} stroke={1.5} color="var(--text-muted)" />}
          emptyMessage={t('Your watchlist is empty')}
          renderItem={renderItem}
          className="watchlistView"
          itemClassName="watchlistView__item"
          selectedItemClassName="watchlistView__item--selected"
          countLabel={watchlist.length > 0 ? (watchlist.length === 1 ? t('{count} video', { count: 1 }) : t('{count} videos', { count: watchlist.length })) : null}
        />
      </div>
    </>
  );
});

export default WatchlistView;
