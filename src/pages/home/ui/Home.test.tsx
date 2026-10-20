import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Home } from './Home';
import { EventCarousel } from './EventCarousel';
import { conference, json, talk } from '../../../../tests/fixtures';
import type { Talk } from '@/entities/talk';
import { seedQuery, updateQuery } from '@/shared/api';
import { setSetting } from '@/shared/config';
import { replacePlaybackHistory, removePlaybackHistoryItem } from '@/features/playback-history';
import type { RecentData } from '@/entities/conference';
import type { CarouselApi } from '../model/types';

const carousel = vi.hoisted(() => ({ canScrollPrev: vi.fn(() => false), canScrollNext: vi.fn(() => true), selectedScrollSnap: vi.fn(() => 0), slideNodes: vi.fn(() => [1, 2, 3]), scrollNext: vi.fn(), scrollPrev: vi.fn(), scrollTo: vi.fn() }));
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, carousel] }));
vi.mock('@/widgets/player', () => ({ Player: ({ event, onClose }: { event: Talk; onClose: () => void }) => <button onClick={onClose}>Close {event.title}</button> }));
vi.mock('@/widgets/talk-preview', () => ({ Preview: ({ event }: { event: Talk }) => <div data-testid="preview">{event.title}</div> }));
const rows = () => Array.from({ length: 7 }, (_, i) => conference({ id: `c${i}`, title: `Conference ${i}`, lectures: { nodes: [talk({ guid: `a${i}`, title: `A${i}` }), talk({ guid: `b${i}`, title: `B${i}` }), talk({ guid: `c${i}`, title: `C${i}`, persons: [], subtitles: undefined, images: {} })] } }));
const props = () => ({ active: true, onReady: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false, setIsPlayerFullscreen: vi.fn() });
const key = (value: string, keyCode = 0) => fireEvent.keyDown(window, { key: value, keyCode });
const tick = async (ms = 200) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
beforeEach(() => {
  vi.useFakeTimers(); carousel.canScrollPrev.mockReturnValue(false); carousel.canScrollNext.mockReturnValue(true); carousel.selectedScrollSnap.mockReturnValue(0);
  setSetting('uiLanguage', 'en');
  seedQuery('recent', { conferencesRecent: rows() });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const offset = JSON.parse(String(init.body)).variables.offset || 0;
    return json({ data: { conferencesRecent: rows().slice(offset) } });
  }));
});

test('home keeps selection while inactive and while the player opens', async () => {
  const callbacks = props(); const view = render(<Home {...callbacks} />);
  await tick();
  expect(screen.getByTestId('preview')).toHaveTextContent('A0');
  key('ArrowRight'); expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  key('Enter'); expect(callbacks.setIsPlayerFullscreen).toHaveBeenCalledWith(true);
  expect(view.container.querySelector('.fluidContainer')).not.toBeVisible();
  key('ArrowDown'); expect(screen.getByRole('button', { name: 'Close B0' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close B0' })); expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button', { name: 'Close B0' })).not.toBeInTheDocument();
  expect(view.container.querySelector('.fluidContainer')).toBeVisible();
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  view.rerender(<Home {...callbacks} active={false} />); key('ArrowRight');
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<Home {...callbacks} />); expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  view.rerender(<Home {...callbacks} sidebarFocused />); key('ArrowRight'); expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  view.rerender(<Home {...callbacks} />);
  key('ArrowRight'); key('ArrowRight'); expect(screen.getByTestId('preview')).toHaveTextContent('C0');
  carousel.canScrollNext.mockReturnValue(false); key('ArrowLeft'); key('ArrowRight');
  carousel.selectedScrollSnap.mockReturnValue(2); key('ArrowLeft');
  key('ArrowLeft'); key('ArrowLeft'); expect(callbacks.onFocusSidebar).toHaveBeenCalled();
  carousel.canScrollPrev.mockReturnValue(true); key('ArrowLeft');
  await tick(3000); expect(callbacks.onReady).toHaveBeenCalled(); expect(localStorage.getItem('home_cache_v1')).not.toBeNull();
});

test('home scrolls conference rows, throttles remote input, and fetches the next page', async () => {
  const view = render(<Home {...props()} />); await tick();
  key('ArrowUp'); await tick();
  for (let index = 0; index < 5; index++) { key('ArrowDown'); key('ArrowDown'); await tick(); }
  await tick();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('preview')).toHaveTextContent('A5');
  act(() => { updateQuery<RecentData>('recent', () => ({ conferencesRecent: rows(), fetched: 9 })); });
  key('ArrowDown'); await tick(); key('ArrowDown'); await tick();
  key('ArrowUp'); key('ArrowUp'); await tick();
  expect(screen.getByTestId('preview').textContent).toMatch(/A\d/);
  view.unmount();
});

test('home handles pagination errors and closes only after the exit delay', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  render(<Home {...props()} />); await tick();
  key('Escape'); expect(close).not.toHaveBeenCalled();
  await tick(4001); key('Escape'); key('', 461); expect(close).toHaveBeenCalledTimes(2);
  vi.mocked(fetch).mockRejectedValue(Error('offline'));
  for (let index = 0; index < 5; index++) { key('ArrowDown'); await tick(); }
  expect(console.error).toHaveBeenCalledWith('Failed to fetch more conferences:', expect.any(Error));
});

test('continue watching preserves the selected talk when history changes', async () => {
  const entries = ['saved-a', 'saved-b', 'saved-c'].map(guid => ({ event: talk({ guid, title: guid }), positionSeconds: 100, durationSeconds: 600 }));
  replacePlaybackHistory(entries);
  render(<Home {...props()} />); await tick();
  expect(screen.getByText('Continue Watching')).toBeVisible();
  key('ArrowRight'); key('ArrowRight'); expect(screen.getByTestId('preview')).toHaveTextContent('saved-c');
  act(() => { replacePlaybackHistory([entries[2], entries[0]]); });
  expect(screen.getByTestId('preview')).toHaveTextContent('saved-c');
  act(() => { removePlaybackHistoryItem('saved-c'); });
  expect(screen.getByTestId('preview')).toHaveTextContent('saved-a');
  key('ArrowDown'); await tick(); key('ArrowUp'); await tick();
  expect(screen.getByTestId('preview')).toHaveTextContent('saved-a');
  act(() => { replacePlaybackHistory([]); });
  expect(screen.queryByText('Continue Watching')).not.toBeInTheDocument();
});

test('home handles initial failures, missing talks, and an absent startup callback', async () => {
  seedQuery('recent', undefined);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
  vi.stubGlobal('__cccbibReady', vi.fn());
  const callbacks = props(); const view = render(<Home {...callbacks} />);
  key('Enter'); expect(callbacks.setIsPlayerFullscreen).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeInTheDocument();
  await tick(); expect(screen.getByText('Error: offline')).toBeVisible();
  view.unmount();
  seedQuery('recent', { conferencesRecent: [conference({ lectures: { nodes: [] }, id: undefined })] });
  vi.stubGlobal('__cccbibReady', undefined);
  const next = render(<Home {...callbacks} />);
  key('Enter'); expect(callbacks.setIsPlayerFullscreen).not.toHaveBeenCalled();
  await tick(); expect(next.container.querySelector('.fluidContainer')).toBeInTheDocument();
});

test('carousel synchronizes its API and displays metadata and watched progress', () => {
  carousel.selectedScrollSnap.mockReturnValue(2);
  const refs = { current: [] as CarouselApi[] };
  const value = conference({ lectures: { nodes: [talk({ subtitles: [{ url: 'eng.vtt', language: 'eng', mimeType: 'text/vtt' }], videos: [{ ...talk().videos[0], language: 'deu-eng' }] }), talk({ guid: 'empty', videos: [], persons: [], subtitles: [] })] } });
  const view = render(<EventCarousel eventApis={refs} events={value} activeEvent={0} ci={0} conferenceTitle="Conference" playbackProgressByGuid={new Map([['talk', 25]])} />);
  expect(carousel.scrollTo).toHaveBeenCalledWith(0, true);
  expect(screen.getByLabelText('25% watched')).toBeInTheDocument();
  view.rerender(<EventCarousel eventApis={refs} events={value} activeEvent={2} ci={1} conferenceTitle="Conference" />);
  expect(refs.current[1]).toBe(carousel);
});
