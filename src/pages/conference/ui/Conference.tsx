import type { Conference } from '@/entities/conference';
import type { PlaybackPageProps } from '@/shared/ui';
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { isPointerDriven, pointerMoved, useMediaQuery, usePageTitle, useWindowEvent } from '@/shared/lib';
import { useQuery } from '@/shared/api';
import { useSetting } from '@/shared/config';
import { GET_CONFERENCE } from '@/entities/conference';
import { Preview } from '@/widgets/talk-preview';
import { Player } from '@/widgets/player';
import { LoadingScreen, Spinner } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

const GRID_TILE_WIDTH = 400;
const GRID_GAP = 16;

const ConferenceView = React.memo(function ConferenceView({ conferenceId, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen, onClose }: PlaybackPageProps & { conferenceId: string }) {
  const t = useTranslation();
  const phone = useMediaQuery('(max-width: 599px)');
  const compact = useMediaQuery('(max-width: 900px)');
  const touch = useMediaQuery('(max-width: 1279px) and (hover: none)');
  const [playerIsOpen, setPlayerIsOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(0);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { error, data } = useQuery<{ conference: Conference }>(`conference:${conferenceId}`, GET_CONFERENCE, { id: conferenceId }, { revalidate: false });
  const loading = !data && !error;
  usePageTitle(data?.conference?.title);

  const [tileScale] = useSetting('tileScale');
  const [textScale] = useSetting('textScale');
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(() => Math.max(600, window.innerWidth - 150));
  const [measuredRowHeight, setMeasuredRowHeight] = useState(0);
  const [scrollRow, setScrollRow] = useState(0);
  const [viewHeight, setViewHeight] = useState(() => window.innerHeight);

  const tileWidth = GRID_TILE_WIDTH * tileScale;
  const eventsPerRow = Math.max(phone ? 1 : 2, Math.floor((gridWidth + GRID_GAP) / (tileWidth + GRID_GAP)));
  const visibleRowBuffer = 3; // Render ±3 rows around active row
  const columnWidth = (gridWidth - GRID_GAP * (eventsPerRow - 1)) / eventsPerRow;
  const itemHeight = measuredRowHeight || Math.round(columnWidth * 9 / 16 + 110 + GRID_GAP);
  const viewRows = Math.ceil(viewHeight / itemHeight);

  useLayoutEffect(() => {
    const measure = () => {
      if (gridRef.current && gridRef.current.clientWidth > 0) setGridWidth(gridRef.current.clientWidth);
      if (containerRef.current && containerRef.current.clientHeight > 0) setViewHeight(containerRef.current.clientHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, tileScale]);

  useLayoutEffect(() => {
    const item = gridRef.current && gridRef.current.querySelector<HTMLElement>('.conferenceView__gridItem');
    if (item && item.offsetHeight > 0) setMeasuredRowHeight(item.offsetHeight + GRID_GAP);
  }, [data, eventsPerRow, textScale, gridWidth]);

  // The window of rendered rows follows what is scrolled into view, so wheel and touch scrolling load rows too
  const { visibleEvents, topSpacerHeight, bottomSpacerHeight, startRow, endRow } = useMemo(() => {
    if (!data?.conference?.lectures?.nodes) {
      return { visibleEvents: [], topSpacerHeight: 0, bottomSpacerHeight: 0, startRow: 0, endRow: -1 };
    }

    const events = data.conference.lectures.nodes;
    const totalEvents = events.length;
    const totalRows = Math.ceil(totalEvents / eventsPerRow);
    const topRow = Math.min(scrollRow, totalRows - 1);

    const startRow = Math.max(0, topRow - visibleRowBuffer);
    const endRow = Math.min(totalRows - 1, topRow + viewRows + visibleRowBuffer);

    const startIndex = startRow * eventsPerRow;
    const endIndex = Math.min(totalEvents, (endRow + 1) * eventsPerRow);

    return {
      visibleEvents: events.slice(startIndex, endIndex).map((event, i) => ({
        ...event,
        originalIndex: startIndex + i
      })),
      topSpacerHeight: startRow * itemHeight,
      bottomSpacerHeight: Math.max(0, (totalRows - endRow - 1) * itemHeight),
      startRow,
      endRow
    };
  }, [data, scrollRow, viewRows, eventsPerRow, visibleRowBuffer, itemHeight]);

  // A key moves the selection before the scrolling follows, so the rows around it are rendered right away
  const keyMovedRef = useRef(false);
  useLayoutEffect(() => {
    if (!keyMovedRef.current) return;
    keyMovedRef.current = false;
    setScrollRow(Math.max(0, Math.floor(activeEvent / eventsPerRow) - Math.floor(viewRows / 2)));
  }, [activeEvent]);

  // Keep scroll position
  const savedScrollPositionRef = useRef(0);
  const playerJustClosedRef = useRef(false);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    savedScrollPositionRef.current = container.scrollTop;
    const gridTop = gridRef.current ? gridRef.current.offsetTop : 0;
    setScrollRow(Math.max(0, Math.floor((container.scrollTop - gridTop) / itemHeight)));
  }, [itemHeight]);

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
      if (selectedItemRef.current && containerRef.current && !isPointerDriven()) {
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

    // A selection scrolled far out of the rendered rows would act on a tile nobody sees, so it moves to the row in view first
    const selectedRow = Math.floor(activeEvent / eventsPerRow);
    if (e.key !== 'Escape' && e.keyCode !== 461 && (selectedRow < startRow || selectedRow > endRow)) {
      e.preventDefault();
      setActiveEvent(Math.min(totalEvents - 1, Math.min(scrollRow, Math.ceil(totalEvents / eventsPerRow) - 1) * eventsPerRow + (activeEvent % eventsPerRow)));
      return;
    }

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
      keyMovedRef.current = true;
      setActiveEvent((prev) => (prev + 1) % totalEvents);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Check if at start of a row (leftmost position)
      if (activeEvent % eventsPerRow === 0) {
        onFocusSidebar();
      } else {
        keyMovedRef.current = true;
        setActiveEvent((prev) => prev - 1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      keyMovedRef.current = true;
      setActiveEvent((prev) => Math.min(prev + eventsPerRow, totalEvents - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      keyMovedRef.current = true;
      setActiveEvent((prev) => Math.max(prev - eventsPerRow, 0));
    }
  });

  const openTalk = (index: number) => {
    setActiveEvent(index);
    setPlayerIsOpen(true);
    setIsPlayerFullscreen(true);
  };

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
        {!compact && <Preview event={events[activeEvent]} />}
        <div className="conferenceView__container scrollable" ref={containerRef} onScroll={handleScroll} data-wheel="scroll" data-wheel-main>
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
              >
                <div className="conferenceView__gridLoading"><Spinner /></div>
              </div>
            )}
            {visibleEvents.map((event) => (
              <div
                key={event.guid}
                ref={event.originalIndex === activeEvent ? selectedItemRef : null}
                className={`conferenceView__gridItem ${event.originalIndex === activeEvent ? 'conferenceView__gridItem--active' : ''}`}
                onClick={touch ? undefined : () => openTalk(event.originalIndex)}
                onMouseMove={(e) => { if (pointerMoved(e)) setActiveEvent(event.originalIndex); }}
              >
                <div className="conferenceView__gridItem__media" onClick={touch ? () => openTalk(event.originalIndex) : undefined}>
                  <img
                    src={event.images.thumbUrl}
                    alt={event.title}
                    className="conferenceView__gridItem__img"
                    loading="lazy"
                  />
                </div>
                <div className="conferenceView__gridItem__title">{event.title}</div>
                {compact && event.description && <div className="conferenceView__gridItem__description">{event.description}</div>}
              </div>
            ))}
            {bottomSpacerHeight > 0 && (
              <div
                className="conferenceView__gridSpacer"
                style={{ height: bottomSpacerHeight, gridColumn: '1 / -1' }}
              >
                <div className="conferenceView__gridLoading"><Spinner /></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default ConferenceView;
