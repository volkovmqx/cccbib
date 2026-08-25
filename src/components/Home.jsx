import React, { useState, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
import { GET_RECENT_CONFERENCES } from '../data';
import { Center, Loader, Container, Box } from '@mantine/core';
import { useWindowEvent, useListState } from '@mantine/hooks';
import { useQuery } from '@apollo/client';
import { Preview } from './Preview';
import { handleArrowDown, handleArrowUp, handleArrowLeft, handleArrowRight } from '../helpers/helpers';
import { EventCarousel } from './EventCarousel';
import { Player } from './Player';
import { preloadImages } from '../hooks/useImagePreload';
import { ErrorBoundary } from './ErrorBoundary';
import { usePlaybackHistory } from '../hooks/usePlaybackHistory';
import '../styles.css';

const Search = lazy(() => import('./Search'));
const ConferenceView = lazy(() => import('./ConferenceView'));
const PopularView = lazy(() => import('./PopularView'));
const EventsListView = lazy(() => import('./EventsListView'));
const Settings = lazy(() => import('./Settings'));
const WatchlistView = lazy(() => import('./WatchlistView'));

const RESERVED_VIEWS = ['search', 'popular', 'recent', 'events', 'settings', 'watchlist'];

const LoadingFallback = () => (
  <Center h="100vh">
    <Loader color="#AAF40D" type="dots" size="xl" />
  </Center>
);

const LazyView = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

export const Home = React.memo(function Home({ selectedItem, onFocusSidebar, onSelectItem, sidebarFocused, isPlayerFullscreen, setIsPlayerFullscreen }) {
  const playbackHistory = usePlaybackHistory();
  const [playerIsOpen, setPlayerIsOpen] = useState(false)
  const [selectedPlayerItem, setSelectedPlayerItem] = useState(null)
  const [selectedSearchEvent, setSelectedSearchEvent] = useState(null)
  const [activeSlice, setActiveSlice] = useState(0)
  const [dataSlice, dataSliceHandlers] = useListState([]);
  const [isLoading, setIsLoading] = useState(false)
  const [activeEvents, setActiveEvents] = useState({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, continueWatching: 0 });
  const [continueWatchingActive, setContinueWatchingActive] = useState(() => playbackHistory.length > 0);
  const [previousView, setPreviousView] = useState('recent');
  const [eventsSelectedIndex, setEventsSelectedIndex] = useState(0);

  const { loading, error, data, fetchMore } = useQuery(GET_RECENT_CONFERENCES, {
    variables: { offset: 0 },
    fetchPolicy: 'cache-first',
  });

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

  const eventApis = useRef([]);
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
  }, [selectedItem]);

  useEffect(() => {
    if (selectedSearchEvent) {
      setIsPlayerFullscreen(true);
    } else if (selectedItem !== 'search') {
      setIsPlayerFullscreen(false);
    }
  }, [selectedSearchEvent, selectedItem, setIsPlayerFullscreen]);

  useWindowEvent('keydown', (e) => {
    if (!data) return
    if (sidebarFocused) return
    if (selectedSearchEvent && selectedItem === 'search') return
    if (playerIsOpen) return

    if ((e.key === 'Escape' || e.keyCode === 461) && selectedItem === 'recent') {
      e.preventDefault()
      // Prevent accidental close right after view switch
      const timeSinceViewChange = Date.now() - lastViewChangeRef.current;
      if (timeSinceViewChange > 4000) {
        window.close()
      }

    } else if (e.key === 'Enter' && !playerIsOpen && selectedItem === 'recent') {
      if (!activeBrowseSelection.event) return;
      setSelectedPlayerItem(activeBrowseSelection);
      setPlayerIsOpen(true)
      setIsPlayerFullscreen(true)
    } else if (e.key === 'ArrowRight' && !playerIsOpen && selectedItem === 'recent') {
      const activeRow = continueWatchingActive ? 'continueWatching' : activeSlice;
      handleArrowRight(eventApis, activeEvents, activeRow, setActiveEvents)
    } else if (e.key === 'ArrowLeft' && !playerIsOpen && selectedItem === 'recent') {
      const activeRow = continueWatchingActive ? 'continueWatching' : activeSlice;
      const currentEventIndex = activeEvents[activeRow] || 0;
      const canScrollPrev = eventApis.current[0] && eventApis.current[0].canScrollPrev();

      if (currentEventIndex === 0 && !canScrollPrev) {
        e.preventDefault();
        onFocusSidebar();
      } else {
        handleArrowLeft(eventApis, activeEvents, activeRow, setActiveEvents);
      }
    } else if (e.key === 'ArrowDown' && !playerIsOpen && selectedItem === 'recent') {
      const now = Date.now();
      if (now - lastVerticalNavRef.current < 150) return;
      lastVerticalNavRef.current = now;
      if (continueWatchingActive) {
        setContinueWatchingActive(false);
      } else {
        handleArrowDown(setActiveSlice, dataSlice, dataSliceHandlers, data, setIsLoading, fetchMore)
      }
    } else if (e.key === 'ArrowUp' && !playerIsOpen && selectedItem === 'recent') {
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

  if (selectedItem === 'search') {
    return (
      <>
        {selectedSearchEvent && (
          <div className="player-fullscreen-container">
            <Player
              event={selectedSearchEvent}
              conferenceTitle={selectedSearchEvent.conference_title}
              onClose={() => {
                setSelectedSearchEvent(null);
                setIsPlayerFullscreen(false);
              }}
            />
          </div>
        )}
        <div style={{ display: selectedSearchEvent ? 'none' : 'block' }}>
          <LazyView>
            <Search
              onClose={() => {
                onSelectItem('recent');
                setSelectedSearchEvent(null);
                setIsPlayerFullscreen(false);
              }}
              onSelectEvent={setSelectedSearchEvent}
              onFocusSidebar={onFocusSidebar}
              sidebarFocused={sidebarFocused}
            />
          </LazyView>
        </div>
      </>
    );
  }

  if (selectedItem === 'recent') {
    if (loading || dataSlice.length === 0) return <LoadingFallback />;
    if (error) return <p>Error : {error.message}</p>;

    // Keep carousel in DOM when player is open to preserve scroll position
    return (
      <>
        {playerIsOpen && selectedPlayerItem && (
          <div className="player-fullscreen-container">
            <Player
              event={selectedPlayerItem.event}
              conferenceTitle={selectedPlayerItem.conferenceTitle}
              onClose={() => {
                setPlayerIsOpen(false);
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
          <Container fluid>
            <Preview
              event={activeBrowseSelection.event}
              conferenceTitle={activeBrowseSelection.conferenceTitle}
            />
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
                          conferenceTitle="Continue Watching"
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
                        <Box className='skeleton'>
                          <div className='loaderContainer'>
                            <Loader color="#AAF40D" type="dots" size="xl" />
                          </div>
                        </Box>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </div>
      </>
    );
  }

  if (selectedItem === 'popular') {
    return (
      <LazyView>
        <PopularView
          onClose={() => onSelectItem('recent')}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          setIsPlayerFullscreen={setIsPlayerFullscreen}
        />
      </LazyView>
    );
  }

  if (selectedItem === 'events') {
    return (
      <LazyView>
        <EventsListView
          onClose={() => onSelectItem('recent')}
          onSelectEvent={(conferenceId) => {
            setPreviousView('events');
            onSelectItem(conferenceId);
          }}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          selectedIndex={eventsSelectedIndex}
          setSelectedIndex={setEventsSelectedIndex}
        />
      </LazyView>
    );
  }

  if (selectedItem === 'watchlist') {
    return (
      <LazyView>
        <WatchlistView
          onClose={() => onSelectItem('recent')}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          setIsPlayerFullscreen={setIsPlayerFullscreen}
        />
      </LazyView>
    );
  }

  if (selectedItem === 'settings') {
    return (
      <LazyView>
        <Settings
          onClose={() => onSelectItem('recent')}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
        />
      </LazyView>
    );
  }

  if (selectedItem && !RESERVED_VIEWS.includes(selectedItem)) {
    return (
      <LazyView>
        <ConferenceView
          conferenceId={selectedItem}
          onFocusSidebar={onFocusSidebar}
          sidebarFocused={sidebarFocused}
          setIsPlayerFullscreen={setIsPlayerFullscreen}
          onClose={() => onSelectItem(previousView)}
        />
      </LazyView>
    );
  }

  return <LoadingFallback />;
});
