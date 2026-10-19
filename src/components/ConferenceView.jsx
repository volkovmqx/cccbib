import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useWindowEvent } from '../hooks/utils';
import { useQuery } from '../graphql';
import { useSetting } from '../settings';
import { GET_CONFERENCE } from '../data';
import { Preview } from './Preview';
import { Player } from './Player';
import { LoadingScreen } from './Spinner';
import { useTranslation } from '../i18n';

const GRID_TILE_WIDTH = 400;
const GRID_GAP = 16;

export const ConferenceView = React.memo(function ConferenceView({ conferenceId, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen, onClose }) {
  const t = useTranslation();
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(0);
  const selectedItemRef = useRef(null);
  const containerRef = useRef(null);

  const { error, data } = useQuery(`conference:${conferenceId}`, GET_CONFERENCE, { id: conferenceId }, { revalidate: false });
  const loading = !data && !error;

  const [tileScale] = useSetting('tileScale');
  const [textScale] = useSetting('textScale');
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(() => Math.max(600, window.innerWidth - 150));
  const [measuredRowHeight, setMeasuredRowHeight] = useState(0);

  const tileWidth = GRID_TILE_WIDTH * tileScale;
  const eventsPerRow = Math.max(2, Math.floor((gridWidth + GRID_GAP) / (tileWidth + GRID_GAP)));
  const visibleRowBuffer = 3; // Render ±3 rows around active row
  const columnWidth = (gridWidth - GRID_GAP * (eventsPerRow - 1)) / eventsPerRow;
  const itemHeight = measuredRowHeight || Math.round(columnWidth * 9 / 16 + 110 + GRID_GAP);

  useLayoutEffect(() => {
    const measure = () => {
      if (gridRef.current) setGridWidth(gridRef.current.clientWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, tileScale]);

  useLayoutEffect(() => {
    const item = gridRef.current && gridRef.current.querySelector('.conferenceView__gridItem');
    if (item) setMeasuredRowHeight(item.offsetHeight + GRID_GAP);
  }, [data, eventsPerRow, textScale, gridWidth]);

  // Calculate visible window of events for virtual scrolling
  const { visibleEvents, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (!data?.conference?.lectures?.nodes) {
      return { visibleEvents: [], topSpacerHeight: 0, bottomSpacerHeight: 0 };
    }

    const events = data.conference.lectures.nodes;
    const totalEvents = events.length;
    const totalRows = Math.ceil(totalEvents / eventsPerRow);
    const activeRow = Math.floor(activeEvent / eventsPerRow);

    const startRow = Math.max(0, activeRow - visibleRowBuffer);
    const endRow = Math.min(totalRows - 1, activeRow + visibleRowBuffer);

    const startIndex = startRow * eventsPerRow;
    const endIndex = Math.min(totalEvents, (endRow + 1) * eventsPerRow);

    return {
      visibleEvents: events.slice(startIndex, endIndex).map((event, i) => ({
        ...event,
        originalIndex: startIndex + i
      })),
      topSpacerHeight: startRow * itemHeight,
      bottomSpacerHeight: Math.max(0, (totalRows - endRow - 1) * itemHeight)
    };
  }, [data, activeEvent, eventsPerRow, visibleRowBuffer, itemHeight]);

  // Keep scroll position
  const savedScrollPositionRef = useRef(0);
  const playerJustClosedRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      savedScrollPositionRef.current = containerRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    if (playerIsOpen) {
      playerJustClosedRef.current = false;
      return;
    }

    playerJustClosedRef.current = true;
    const resetTimeout = setTimeout(() => {
      playerJustClosedRef.current = false;
    }, 300);

    if (savedScrollPositionRef.current > 0) {
      const scrollTimeout = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedScrollPositionRef.current;
        }
      }, 100);
      return () => {
        clearTimeout(resetTimeout);
        clearTimeout(scrollTimeout);
      };
    }

    return () => clearTimeout(resetTimeout);
  }, [playerIsOpen]);

  useEffect(() => {
    if (playerIsOpen) return;

    const timeoutId = setTimeout(() => {
      if (selectedItemRef.current && containerRef.current) {
        const container = containerRef.current;
        const item = selectedItemRef.current;
        const headerOffset = 70;

        const itemTop = item.offsetTop - headerOffset;
        const itemBottom = item.offsetTop + item.offsetHeight;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        if (itemTop < containerScrollTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerScrollTop + containerHeight) {
          container.scrollTop = itemBottom - containerHeight + 20;
        }
        savedScrollPositionRef.current = container.scrollTop;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeEvent]);

  // Keyboard navigation
  useWindowEvent('keydown', (e) => {
    if (!data || !data.conference || !data.conference.lectures) return;
    const totalEvents = data.conference.lectures.nodes.length;

    // Don't handle keyboard events when player is open (Player handles its own back/escape)
    if (playerIsOpen) return;

    // Don't handle keyboard events if sidebar is focused
    if (sidebarFocused) return;

    if (e.key === 'Escape' || e.keyCode === 461) {
      e.preventDefault();
      if (!playerJustClosedRef.current) {
        onClose?.();
      }
    } else if (e.key === 'Enter') {
      setPlayerIsOpen(true);
      setIsPlayerFullscreen(true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveEvent((prev) => (prev + 1) % totalEvents);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Check if at start of a row (leftmost position)
      if (activeEvent % eventsPerRow === 0) {
        onFocusSidebar();
      } else {
        setActiveEvent((prev) => prev - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveEvent((prev) => Math.min(prev + eventsPerRow, totalEvents - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveEvent((prev) => Math.max(prev - eventsPerRow, 0));
    }
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <p>{t('Error: {message}', { message: error.message })}</p>;
  }

  if (!data || !data.conference || !data.conference.lectures || !data.conference.lectures.nodes.length) {
    return (
      <div className="center" style={{ height: '100vh' }}>
        <p>{t('No videos found for this conference.')}</p>
      </div>
    );
  }

  const conference = data.conference;
  const events = conference.lectures.nodes;

  return (
    <>
      {playerIsOpen && (
        <div className="player-fullscreen-container">
          <Player
            event={events[activeEvent]}
            conferenceTitle={conference.title}
            onClose={() => {
              setPlayerIsOpen(false);
              setIsPlayerFullscreen(false);
            }}
          />
        </div>
      )}
      <div className="fluidContainer" style={{ display: playerIsOpen ? 'none' : 'block' }}>
        <Preview
          event={events[activeEvent]}
          conferenceTitle={conference.title}
          disableVideo={playerIsOpen}
        />
        <div className="conferenceView__container scrollable" ref={containerRef} onScroll={handleScroll}>
          <div className="conferenceView__header">
            <h2 className="conferenceView__title">{conference.title}</h2>
          </div>
          <div
            className="conferenceView__grid"
            ref={gridRef}
            style={{ gridTemplateColumns: `repeat(${eventsPerRow}, minmax(0, 1fr))` }}
          >
            {topSpacerHeight > 0 && (
              <div
                className="conferenceView__gridSpacer"
                style={{ height: topSpacerHeight, gridColumn: '1 / -1' }}
              />
            )}
            {visibleEvents.map((event) => (
              <div
                key={event.guid}
                ref={event.originalIndex === activeEvent ? selectedItemRef : null}
                className={`conferenceView__gridItem ${event.originalIndex === activeEvent ? 'conferenceView__gridItem--active' : ''}`}
                onClick={() => setActiveEvent(event.originalIndex)}
              >
                <div className="conferenceView__gridItem__media">
                  <img
                    src={event.images.thumbUrl}
                    alt={event.title}
                    className="conferenceView__gridItem__img"
                    loading="lazy"
                  />
                </div>
                <div className="conferenceView__gridItem__title">{event.title}</div>
              </div>
            ))}
            {bottomSpacerHeight > 0 && (
              <div
                className="conferenceView__gridSpacer"
                style={{ height: bottomSpacerHeight, gridColumn: '1 / -1' }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default ConferenceView;
