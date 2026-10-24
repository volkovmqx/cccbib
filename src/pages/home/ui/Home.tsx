import type { RecentData } from '@/entities/conference';
import type { PlaybackPageProps } from '@/shared/ui';
import type { CarouselApi, HomeRow, TalkSelection } from '../model/types';
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { GET_RECENT_CONFERENCES, RECENT_KEY, mergeRecent } from '@/entities/conference';
import { isWebOS, useMediaQuery, useWindowEvent } from '@/shared/lib';
import { useQuery, graphqlRequest, updateQuery } from '@/shared/api';
import { Preview } from '@/widgets/talk-preview';
import { handleArrowLeft, handleArrowRight } from '../model/navigation';
import { EventCarousel } from './EventCarousel';
import { Player } from '@/widgets/player';
import { usePlaybackHistory } from '@/features/playback-history';
import { saveHomeCache } from '@/entities/conference';
import { LoadingScreen, PageScrollbar, Spinner } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

const CONFERENCES_PER_PAGE = 6;
const PREFETCH_ROWS = 5;
const ROWS_ABOVE = 1;
const ROWS_BELOW = 3;
const KEEP_ABOVE = 2;
const KEEP_BELOW = 4;
const CONTINUE_KEY = 'continueWatching';
export const Home = React.memo(function Home({ active, onReady, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen, onOpenConference }: Omit<PlaybackPageProps, 'onClose'> & { active: boolean; onReady: () => void; onOpenConference?: (conferenceId: string) => void }) {
  const t = useTranslation();
  const compact = useMediaQuery('(max-width: 900px)');
  const touch = useMediaQuery('(max-width: 1279px) and (hover: none)');
  const [selectedPlayerItem, setSelectedPlayerItem] = useState<TalkSelection | null>(null);
  const playerIsOpen = selectedPlayerItem !== null;
  // The saved position changes every 10 seconds while a video plays, the page below shows it once the player closes
  const liveHistory = usePlaybackHistory();
  const heldHistory = useRef(liveHistory);
  if (!playerIsOpen) heldHistory.current = liveHistory;
  const playbackHistory = heldHistory.current;
  const { error, data } = useQuery(RECENT_KEY, GET_RECENT_CONFERENCES, { offset: 0 }, { merge: mergeRecent });
  const fetchMore = useCallback((offset: number) => graphqlRequest<RecentData>(GET_RECENT_CONFERENCES, { offset }).then(
    (result) => updateQuery<RecentData>(RECENT_KEY, (existing) => mergeRecent(existing, result, offset))
  ), []);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeEvents, setActiveEvents] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false)
  const [scrollRow, setScrollRow] = useState(0);

  const conferences = data?.conferencesRecent;
  const rows = useMemo<HomeRow[]>(() => {
    const list: HomeRow[] = [];
    if (playbackHistory.length > 0) {
      list.push({
        key: CONTINUE_KEY,
        title: t('Continue Watching'),
        events: { lectures: { nodes: playbackHistory.map(item => item.event) } },
        conferenceTitleAt: (index) => playbackHistory[index]?.conferenceTitle || '',
      });
    }
    (conferences || []).forEach((conference, index) => list.push({
      key: String(conference.id ?? index),
      conferenceId: conference.id,
      title: conference.title,
      events: conference,
      conferenceTitleAt: () => conference.title || '',
    }));
    return list;
  }, [conferences, playbackHistory, t]);
  const activeRow = Math.max(0, rows.findIndex(row => row.key === activeKey));

  useEffect(() => {
    if (conferences) setIsLoading(false);
  }, [conferences]);

  useEffect(() => {
    if (rows.length > 0 || (error && !data)) window.__cccbibReady?.();
  }, [rows.length, error, data]);

  const homeReady = rows.length > 0;
  useEffect(() => {
    if (!homeReady) return undefined;
    const timer = setTimeout(onReady, 1500);
    return () => clearTimeout(timer);
  }, [homeReady, onReady]);

  useEffect(() => {
    if (!conferences) return undefined;
    const timer = setTimeout(() => saveHomeCache(conferences.slice(0, CONFERENCES_PER_PAGE)), 3000);
    return () => clearTimeout(timer);
  }, [conferences]);

  const eventApis = useRef<CarouselApi[]>([]);
  const lastViewChangeRef = useRef(0);
  const lastVerticalNavRef = useRef(0);
  const previousPlaybackHistoryRef = useRef(playbackHistory);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const keyboardRowRef = useRef(false);
  const fetchedFromRef = useRef(-1);

  const playbackProgressByGuid = useMemo(() => new Map(
    playbackHistory.map(item => [
      item.event.guid,
      Math.min(100, Math.max(0, (item.positionSeconds / item.durationSeconds) * 100)),
    ])
  ), [playbackHistory]);

  const activeBrowseSelection = useMemo(() => {
    const row = rows[activeRow];
    if (!row) return { event: null, conferenceTitle: '' };
    const index = activeEvents[row.key] || 0;
    return { event: row.events.lectures.nodes[index] || null, conferenceTitle: row.conferenceTitleAt(index) };
  }, [rows, activeRow, activeEvents]);

  useEffect(() => {
    const previousHistory = previousPlaybackHistoryRef.current;

    setActiveEvents(current => {
      const previousIndex = current[CONTINUE_KEY] || 0;
      const previousGuid = previousHistory[previousIndex]?.event.guid;
      const matchingIndex = previousGuid
        ? playbackHistory.findIndex(item => item.event.guid === previousGuid)
        : -1;
      const nextIndex = matchingIndex >= 0
        ? matchingIndex
        : Math.min(previousIndex, Math.max(0, playbackHistory.length - 1));

      if (nextIndex === previousIndex) return current;
      return { ...current, [CONTINUE_KEY]: nextIndex };
    });

    previousPlaybackHistoryRef.current = playbackHistory;
  }, [playbackHistory]);

  useEffect(() => {
    lastViewChangeRef.current = Date.now();
  }, [active]);

  useLayoutEffect(() => {
    if (!keyboardRowRef.current) return;
    keyboardRowRef.current = false;
    const scroller = scrollerRef.current;
    const row = scroller && scroller.firstElementChild && scroller.firstElementChild.children[activeRow];
    if (scroller && row) scroller.scrollTop = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }, [activeKey]);

  // Every row in the page costs the TV time on each key press, so only the rows around the screen are built and the others are a title
  // A row is built when it comes within reach, kept a little longer so going back does not build it again, and dropped beyond that
  const deferredRow = useDeferredValue(scrollRow);
  const builtRows = useRef(new Set<string>());
  const [rowHeight, setRowHeight] = useState(0);
  useLayoutEffect(() => {
    const list = scrollerRef.current && scrollerRef.current.firstElementChild;
    if (!list) return;
    const heights = Array.from(list.children).filter((element) => element.querySelector('.embla')).slice(0, 4).map((element) => element.getBoundingClientRect().height);
    if (heights.length === 0) return;
    const average = Math.round(heights.reduce((sum, height) => sum + height, 0) / heights.length);
    setRowHeight((current) => (Math.abs(current - average) > 2 ? average : current));
  }, [rows.length, compact]);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const list = scroller.firstElementChild;
    const average = list && list.children.length > 0 ? list.scrollHeight / list.children.length : 0;
    setScrollRow(average > 0 ? Math.floor(scroller.scrollTop / average) : 0);
  }, []);

  useEffect(() => {
    if (!data || Math.max(activeRow, scrollRow) + PREFETCH_ROWS < rows.length) return;
    const offset = data.fetched || data.conferencesRecent.length;
    if (fetchedFromRef.current === offset) return;
    fetchedFromRef.current = offset;
    setIsLoading(true);
    fetchMore(offset).catch((err) => {
      console.error('Failed to fetch more conferences:', err);
      fetchedFromRef.current = -1;
      setIsLoading(false);
    });
  }, [data, activeRow, scrollRow, rows.length, fetchMore]);

  const hoverTile = useCallback((rowIndex: number, index: number) => {
    const row = rows[rowIndex];
    if (!row) return;
    setActiveKey(row.key);
    setActiveEvents(current => ({ ...current, [row.key]: index }));
  }, [rows]);
  const openTile = useCallback((rowIndex: number, index: number) => {
    const row = rows[rowIndex];
    const event = row && row.events.lectures.nodes[index];
    if (!row || !event) return;
    setActiveKey(row.key);
    setActiveEvents(current => ({ ...current, [row.key]: index }));
    setSelectedPlayerItem({ event, conferenceTitle: row.conferenceTitleAt(index) });
    setIsPlayerFullscreen(true);
  }, [rows, setIsPlayerFullscreen]);

  // The remote has no pointer, so the conference names only open their page in a browser
  const openConference = isWebOS() ? undefined : onOpenConference;

  const closePlayer = useCallback(() => {
    setSelectedPlayerItem(null);
    setIsPlayerFullscreen(false);
  }, [setIsPlayerFullscreen]);

  const moveRow = (delta: number) => {
    const now = Date.now();
    if (now - lastVerticalNavRef.current < 150) return;
    lastVerticalNavRef.current = now;
    const next = Math.min(rows.length - 1, Math.max(0, activeRow + delta));
    if (next === activeRow) return;
    keyboardRowRef.current = true;
    setActiveKey(rows[next].key);
  };

  useWindowEvent('keydown', (e) => {
    if (!active || !data) return
    if (sidebarFocused) return
    if (playerIsOpen) return
    const row = rows[activeRow];

    if (e.key === 'Escape' || e.keyCode === 461) {
      e.preventDefault()
      // Prevent accidental close right after view switch
      const timeSinceViewChange = Date.now() - lastViewChangeRef.current;
      if (timeSinceViewChange > 4000) {
        window.close()
      }

    } else if (e.key === 'Enter') {
      if (!activeBrowseSelection.event) return;
      setSelectedPlayerItem(activeBrowseSelection);
      setIsPlayerFullscreen(true)
    } else if (!row) {
      return;
    } else if (e.key === 'ArrowRight') {
      handleArrowRight(eventApis.current[activeRow], activeEvents, row.key, setActiveEvents)
    } else if (e.key === 'ArrowLeft') {
      const currentEventIndex = activeEvents[row.key] || 0;
      const api = eventApis.current[activeRow];
      const canScrollPrev = api && api.canScrollPrev();

      if (currentEventIndex === 0 && !canScrollPrev) {
        e.preventDefault();
        onFocusSidebar();
      } else {
        handleArrowLeft(api, activeEvents, row.key, setActiveEvents);
      }
    } else if (e.key === 'ArrowDown') {
      moveRow(1);
    } else if (e.key === 'ArrowUp') {
      moveRow(-1);
    }
  })

  if (!active) return null;
  if (error && rows.length === 0) return <p>{t('Error: {message}', { message: error.message })}</p>;
  if (rows.length === 0) return <LoadingScreen />;

  // Hiding the page under the player makes the TV repaint all of it when the video ends
  return (
    <>
      {selectedPlayerItem && (
        <div className="player-fullscreen-container">
          <Player
            event={selectedPlayerItem.event}
            conferenceTitle={selectedPlayerItem.conferenceTitle}
            onClose={closePlayer}
          />
        </div>
      )}
      <div style={{ pointerEvents: playerIsOpen ? 'none' : 'auto' }}>
        <div className="fluidContainer">
          {activeBrowseSelection.event && !compact && <Preview event={activeBrowseSelection.event} disableVideo={playerIsOpen} />}
          <div className="container">
            <div className="embla_vertical">
              <div className="embla__viewport homeRows" ref={scrollerRef} onScroll={onScroll} data-wheel="scroll" data-wheel-main>
                <div className="embla__container embla__container_vertical">
                  {rows.map((row, index) => {
                    const visible = index === activeRow || (index >= scrollRow && index <= scrollRow + 1);
                    if (visible || (index >= deferredRow - ROWS_ABOVE && index <= deferredRow + ROWS_BELOW)) builtRows.current.add(row.key);
                    else if (index < scrollRow - KEEP_ABOVE || index > scrollRow + KEEP_BELOW) builtRows.current.delete(row.key);
                    const near = builtRows.current.has(row.key);
                    return (
                      <div className="embla__slide" key={row.key}>
                        {near ? (
                          <EventCarousel
                            eventApis={eventApis}
                            events={row.events}
                            activeEvent={activeEvents[row.key] || 0}
                            rowIndex={index}
                            active={index === activeRow}
                            near={near}
                            conferenceTitle={row.title}
                            onOpenConference={row.conferenceId && openConference ? () => openConference(row.conferenceId!) : undefined}
                            playbackProgressByGuid={playbackProgressByGuid}
                            showDescription={compact}
                            pictureOnly={touch}
                            onHover={hoverTile}
                            onOpen={openTile}
                          />
                        ) : (
                          <div className="rowPlaceholder" style={rowHeight ? { height: rowHeight } : undefined}>
                            <h2 className="carouselTitle">{row.title}</h2>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="embla__slide">
                      <div className='skeleton'>
                        <div className='loaderContainer'>
                          <Spinner />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <PageScrollbar scrollerRef={scrollerRef} watch={rows.length} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
