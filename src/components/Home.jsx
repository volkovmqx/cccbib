import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { GET_RECENT_CONFERENCES, RECENT_KEY, mergeRecent } from '../data';
import { useWindowEvent, useListState } from '../hooks/utils';
import { useQuery, graphqlRequest, updateQuery } from '../graphql';
import { Preview } from './Preview';
import { handleArrowDown, handleArrowUp, handleArrowLeft, handleArrowRight } from '../helpers/helpers';
import { EventCarousel } from './EventCarousel';
import { Player } from './Player';
import { preloadImages } from '../hooks/useImagePreload';
import { ErrorBoundary } from './ErrorBoundary';
import { usePlaybackHistory } from '../hooks/usePlaybackHistory';
import { saveHomeCache } from '../helpers/homeCache';
import { LoadingScreen, Spinner } from './Spinner';
import { useTranslation } from '../i18n';

const loadSearch = () => import('./Search');
const loadConferenceView = () => import('./ConferenceView');
const loadPopularView = () => import('./PopularView');
const loadEventsListView = () => import('./EventsListView');
const loadSettings = () => import('./Settings');
const loadWatchlistView = () => import('./WatchlistView');

const PRELOAD_DELAY_MS = 1500;
const PRELOAD_GAP_MS = 400;
const viewPreloaders = [];

function lazyView(load) {
  let Loaded = null;
  const remember = (module) => {
    Loaded = module.default;
    return module;
  };
  const Lazy = lazy(() => load().then(remember));
  const View = (props) => {
    const [Component] = useState(() => Loaded || Lazy);
    return <Component {...props} />;
  };
  viewPreloaders.push(() => load().then(remember));
  return View;
}

const Search = lazyView(loadSearch);
const ConferenceView = lazyView(loadConferenceView);
const PopularView = lazyView(loadPopularView);
const EventsListView = lazyView(loadEventsListView);
const Settings = lazyView(loadSettings);
const WatchlistView = lazyView(loadWatchlistView);

function preloadViews() {
  viewPreloaders.reduce((chain, preload) => chain
    .then(() => new Promise((resolve) => setTimeout(resolve, PRELOAD_GAP_MS)))
    .then(preload)
    .catch(() => {}), Promise.resolve());
}

const CONFERENCES_PER_PAGE = 6;
const RESERVED_VIEWS = ['search', 'popular', 'recent', 'events', 'settings', 'watchlist'];

const LazyView = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

export const Home = React.memo(function Home({ selectedItem, onFocusSidebar, onSelectItem, sidebarFocused, setIsPlayerFullscreen }) {
  const t = useTranslation();
  const playbackHistory = usePlaybackHistory();
  const { error, data } = useQuery(RECENT_KEY, GET_RECENT_CONFERENCES, { offset: 0 }, { merge: mergeRecent });
  const fetchMore = useCallback((offset) => graphqlRequest(GET_RECENT_CONFERENCES, { offset }).then(
    (result) => updateQuery(RECENT_KEY, (existing) => mergeRecent(existing, result, offset))
  ), []);
  const [playerIsOpen, setPlayerIsOpen] = useState(false)
  const [selectedPlayerItem, setSelectedPlayerItem] = useState(null)
  const [selectedSearchEvent, setSelectedSearchEvent] = useState(null)
  const [activeSlice, setActiveSlice] = useState(0)
  const [dataSlice, dataSliceHandlers] = useListState(data?.conferencesRecent || []);
  const [isLoading, setIsLoading] = useState(false)
  const [activeEvents, setActiveEvents] = useState({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, continueWatching: 0 });
  const [continueWatchingActive, setContinueWatchingActive] = useState(() => playbackHistory.length > 0);
  const [previousView, setPreviousView] = useState('recent');
  const [eventsSelectedIndex, setEventsSelectedIndex] = useState(0);

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
    const timer = setTimeout(preloadViews, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [homeReady]);

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
    if (error && dataSlice.length === 0) return <p>{t('Error: {message}', { message: error.message })}</p>;
    if (dataSlice.length === 0) return <LoadingScreen />;

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
          <div className="fluidContainer">
            <Preview
              event={activeBrowseSelection.event}
              disableVideo={playerIsOpen}
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

  return <LoadingScreen />;
});
