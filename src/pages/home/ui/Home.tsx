import type { RecentData } from '@/entities/conference';
import type { PlaybackPageProps } from '@/shared/ui';
import type { CarouselApi, TalkSelection } from '../model/types';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GET_RECENT_CONFERENCES, RECENT_KEY, mergeRecent } from '@/entities/conference';
import { useWindowEvent, useListState } from '@/shared/lib';
import { useQuery, graphqlRequest, updateQuery } from '@/shared/api';
import { Preview } from '@/widgets/talk-preview';
import { handleArrowDown, handleArrowUp, handleArrowLeft, handleArrowRight } from '../model/navigation';
import { EventCarousel } from './EventCarousel';
import { Player } from '@/widgets/player';
import { preloadImages } from '@/shared/lib';
import { usePlaybackHistory } from '@/features/playback-history';
import { saveHomeCache } from '@/entities/conference';
import { LoadingScreen, Spinner } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

const CONFERENCES_PER_PAGE = 6;
export const Home = React.memo(function Home({ active, onReady, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }: Omit<PlaybackPageProps, 'onClose'> & { active: boolean; onReady: () => void }) {
  const t = useTranslation();
  const playbackHistory = usePlaybackHistory();
  const { error, data } = useQuery(RECENT_KEY, GET_RECENT_CONFERENCES, { offset: 0 }, { merge: mergeRecent });
  const fetchMore = useCallback((offset: number) => graphqlRequest<RecentData>(GET_RECENT_CONFERENCES, { offset }).then(
    (result) => updateQuery<RecentData>(RECENT_KEY, (existing) => mergeRecent(existing, result, offset))
  ), []);
  const [selectedPlayerItem, setSelectedPlayerItem] = useState<TalkSelection | null>(null)
  const playerIsOpen = selectedPlayerItem !== null;
  const [activeSlice, setActiveSlice] = useState(0)
  const [dataSlice, dataSliceHandlers] = useListState(data?.conferencesRecent || []);
  const [isLoading, setIsLoading] = useState(false)
  const [activeEvents, setActiveEvents] = useState<Record<string, number>>({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, continueWatching: 0 });
  const [continueWatchingActive, setContinueWatchingActive] = useState(() => playbackHistory.length > 0);

  useEffect(() => {
    if (!data) return
    if (data.conferencesRecent) {
      if (activeSlice === 0) {
        dataSliceHandlers.setState(data.conferencesRecent)
      } else {
        dataSliceHandlers.setState(data.conferencesRecent.slice(activeSlice, activeSlice + 6))
      }
      setIsLoading(false)
    }
  }, [data])

  useEffect(() => {
    if (dataSlice.length > 0 || (error && !data)) window.__cccbibReady?.();
  }, [dataSlice.length, error, data]);

  const homeReady = dataSlice.length > 0;
  useEffect(() => {
    if (!homeReady) return undefined;
    const timer = setTimeout(onReady, 1500);
    return () => clearTimeout(timer);
  }, [homeReady, onReady]);

  useEffect(() => {
    if (!data?.conferencesRecent) return undefined;
    const timer = setTimeout(() => saveHomeCache(data.conferencesRecent.slice(0, CONFERENCES_PER_PAGE)), 3000);
    return () => clearTimeout(timer);
  }, [data]);

  // Preload images from next conference row for smoother vertical navigation
  useEffect(() => {
    if (!data?.conferencesRecent) return;
    const nextRowIndex = activeSlice + 6;
    const nextConference = data.conferencesRecent[nextRowIndex];
    if (nextConference?.lectures?.nodes) {
      const urls = nextConference.lectures.nodes
        .slice(0, 8)
        .map(e => e.images?.thumbUrl)
        .filter(Boolean);
      preloadImages(urls);
    }
  }, [activeSlice, data])

  const eventApis = useRef<CarouselApi[]>([]);
  const lastViewChangeRef = useRef(0);
  const lastVerticalNavRef = useRef(0);
  const previousPlaybackHistoryRef = useRef(playbackHistory);

  const continueWatchingEvents = useMemo(() => ({
    lectures: {
      nodes: playbackHistory.map(item => item.event),
    },
  }), [playbackHistory]);

  const playbackProgressByGuid = useMemo(() => new Map(
    playbackHistory.map(item => [
      item.event.guid,
      Math.min(100, Math.max(0, (item.positionSeconds / item.durationSeconds) * 100)),
    ])
  ), [playbackHistory]);

  const activeBrowseSelection = useMemo(() => {
    const continueWatchingItem = playbackHistory[activeEvents.continueWatching || 0];
    if (continueWatchingActive && continueWatchingItem) {
      return {
        event: continueWatchingItem.event,
        conferenceTitle: continueWatchingItem.conferenceTitle,
      };
    }

    const conference = dataSlice[0];
    return {
      event: conference?.lectures.nodes[activeEvents[activeSlice] || 0] || null,
      conferenceTitle: conference?.title || '',
    };
  }, [activeEvents, activeSlice, continueWatchingActive, dataSlice, playbackHistory]);

  useEffect(() => {
    const previousHistory = previousPlaybackHistoryRef.current;

    setActiveEvents(current => {
      const previousIndex = current.continueWatching || 0;
      const previousGuid = previousHistory[previousIndex]?.event.guid;
      const matchingIndex = previousGuid
        ? playbackHistory.findIndex(item => item.event.guid === previousGuid)
        : -1;
      const nextIndex = matchingIndex >= 0
        ? matchingIndex
        : Math.min(previousIndex, Math.max(0, playbackHistory.length - 1));

      if (nextIndex === previousIndex) return current;
      return { ...current, continueWatching: nextIndex };
    });

    if (playbackHistory.length === 0) setContinueWatchingActive(false);
    previousPlaybackHistoryRef.current = playbackHistory;
  }, [playbackHistory]);

  useEffect(() => {
    lastViewChangeRef.current = Date.now();
  }, [active]);

  useWindowEvent('keydown', (e) => {
    if (!active || !data) return
    if (sidebarFocused) return
    if (playerIsOpen) return

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
    } else if (e.key === 'ArrowRight') {
      const activeRow = continueWatchingActive ? 'continueWatching' : activeSlice;
      handleArrowRight(eventApis, activeEvents, activeRow, setActiveEvents)
    } else if (e.key === 'ArrowLeft') {
      const activeRow = continueWatchingActive ? 'continueWatching' : activeSlice;
      const currentEventIndex = activeEvents[activeRow] || 0;
      const canScrollPrev = eventApis.current[0] && eventApis.current[0].canScrollPrev();

      if (currentEventIndex === 0 && !canScrollPrev) {
        e.preventDefault();
        onFocusSidebar();
      } else {
        handleArrowLeft(eventApis, activeEvents, activeRow, setActiveEvents);
      }
    } else if (e.key === 'ArrowDown') {
      const now = Date.now();
      if (now - lastVerticalNavRef.current < 150) return;
      lastVerticalNavRef.current = now;
      if (continueWatchingActive) {
        setContinueWatchingActive(false);
      } else {
        handleArrowDown(setActiveSlice, dataSlice, dataSliceHandlers, data, setIsLoading, fetchMore)
      }
    } else if (e.key === 'ArrowUp') {
      const now = Date.now();
      if (now - lastVerticalNavRef.current < 150) return;
      lastVerticalNavRef.current = now;
      if (activeSlice === 0 && playbackHistory.length > 0 && !continueWatchingActive) {
        setContinueWatchingActive(true);
      } else if (!continueWatchingActive) {
        handleArrowUp(setActiveSlice, dataSliceHandlers, data)
      }
    }
  })

  if (!active) return null;
  if (error && dataSlice.length === 0) return <p>{t('Error: {message}', { message: error.message })}</p>;
  if (dataSlice.length === 0) return <LoadingScreen />;

  // Keep carousel in DOM when player is open to preserve scroll position
  return (
    <>
      {selectedPlayerItem && (
        <div className="player-fullscreen-container">
          <Player
            event={selectedPlayerItem.event}
            conferenceTitle={selectedPlayerItem.conferenceTitle}
            onClose={() => {
              setSelectedPlayerItem(null);
              setIsPlayerFullscreen(false);
            }}
          />
        </div>
      )}
      <div style={{
        visibility: playerIsOpen ? 'hidden' : 'visible',
        pointerEvents: playerIsOpen ? 'none' : 'auto'
      }}>
        <div className="fluidContainer">
          {activeBrowseSelection.event && <Preview
            event={activeBrowseSelection.event}
            disableVideo={playerIsOpen}
          />}
          <div className="container">
            <div className="embla_vertical">
              <div className="embla__viewport">
                <div className="embla__container embla__container_vertical">
                  {continueWatchingActive && playbackHistory.length > 0 && (
                    <div className="embla__slide" key="continue-watching">
                      <EventCarousel
                        eventApis={eventApis}
                        events={continueWatchingEvents}
                        activeEvent={activeEvents.continueWatching || 0}
                        ci={0}
                        conferenceTitle={t('Continue Watching')}
                        playbackProgressByGuid={playbackProgressByGuid}
                      />
                    </div>
                  )}
                  {dataSlice.map((c, ci) => (
                    <div className="embla__slide" key={c.id || ci}>
                      <EventCarousel
                        eventApis={eventApis}
                        events={c}
                        activeEvent={activeEvents[ci + activeSlice]}
                        ci={ci + (continueWatchingActive ? 1 : 0)}
                        conferenceTitle={c.title}
                        playbackProgressByGuid={playbackProgressByGuid}
                      />
                    </div>
                  ))}
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
