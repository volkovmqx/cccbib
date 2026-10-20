import type { Talk } from '@/entities/talk';
import type { PlaybackPageProps } from '@/shared/ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Home } from '@/pages/home';
import { Player } from '@/widgets/player';
import { ErrorBoundary, LoadingScreen } from '@/shared/ui';

interface ScreenProps extends Omit<PlaybackPageProps, 'onClose'> { selectedItem: string; onSelectItem: (item: string) => void }





const loadSearch = () => import('@/pages/search');
const loadConferenceView = () => import('@/pages/conference');
const loadPopularView = () => import('@/pages/popular');
const loadEventsListView = () => import('@/pages/conferences');
const loadSettings = () => import('@/pages/settings');
const loadWatchlistView = () => import('@/pages/watchlist');

const PRELOAD_GAP_MS = 400;
const viewPreloaders: (() => Promise<unknown>)[] = [];

function lazyView<P extends object>(load: () => Promise<{ default: React.ComponentType<P> }>) {
  let Loaded: React.ComponentType<P> | null = null;
  const remember = (module: { default: React.ComponentType<P> }) => {
    Loaded = module.default;
    return module;
  };
  const Lazy = lazy(() => load().then(remember));
  const View = (props: P) => {
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
    .catch(() => {}), Promise.resolve<unknown>(undefined));
}

const RESERVED_VIEWS = ['search', 'popular', 'recent', 'events', 'settings', 'watchlist'];

const LazyView = ({ children }: React.PropsWithChildren) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

function SelectedScreen({ selectedItem, onSelectItem, onFocusSidebar, sidebarFocused, setIsPlayerFullscreen }: ScreenProps) {
  const [selectedSearchEvent, setSelectedSearchEvent] = useState<Talk | null>(null);
  const [previousView, setPreviousView] = useState('recent');
  const [eventsSelectedIndex, setEventsSelectedIndex] = useState(0);
  useEffect(() => {
    if (selectedSearchEvent) setIsPlayerFullscreen(true);
    else if (selectedItem !== 'search') setIsPlayerFullscreen(false);
  }, [selectedSearchEvent, selectedItem, setIsPlayerFullscreen]);
  if (selectedItem === 'recent') return null;
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
}

export function Screens(props: ScreenProps) {
  return <>
    <Home active={props.selectedItem === 'recent'} onReady={preloadViews} onFocusSidebar={props.onFocusSidebar}
      sidebarFocused={props.sidebarFocused} setIsPlayerFullscreen={props.setIsPlayerFullscreen} />
    <SelectedScreen {...props} />
  </>;
}
