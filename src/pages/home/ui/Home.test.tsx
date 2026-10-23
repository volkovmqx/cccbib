import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Home } from './Home';
import { EventCarousel } from './EventCarousel';
import { conference, json, talk } from '../../../../tests/fixtures';
import { formatDuration, type Talk } from '@/entities/talk';
import { seedQuery, updateQuery } from '@/shared/api';
import { setSetting } from '@/shared/config';
import { replacePlaybackHistory, removePlaybackHistoryItem } from '@/features/playback-history';
import type { RecentData } from '@/entities/conference';
import type { CarouselApi } from '../model/types';

const carousel = vi.hoisted(() => ({ options: {} as { startIndex?: number }, starts: [] as (number | undefined)[], canScrollPrev: vi.fn(() => false), canScrollNext: vi.fn(() => true), selectedScrollSnap: vi.fn(() => 0), slideNodes: vi.fn(() => [1, 2, 3]), scrollNext: vi.fn(), scrollPrev: vi.fn(), scrollTo: vi.fn(), reInit: vi.fn() }));
vi.mock('embla-carousel-react', () => ({ default: (options: { startIndex?: number }) => { carousel.options = options; carousel.starts.push(options.startIndex); return [() => {}, carousel]; } }));
vi.mock('@/widgets/player', () => ({ Player: ({ event, onClose }: { event: Talk; onClose: () => void }) => <button onClick={onClose}>Close {event.title}</button> }));
vi.mock('@/entities/talk', async (importOriginal) => { const original = await importOriginal<typeof import('@/entities/talk')>(); return { ...original, formatDuration: vi.fn(original.formatDuration) }; });
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
  const screenUnderPlayer = view.container.querySelector('.fluidContainer')!.parentElement!;
  expect(screenUnderPlayer).toBeVisible();
  expect(screenUnderPlayer.style.pointerEvents).toBe('none');
  key('ArrowDown'); expect(screen.getByRole('button', { name: 'Close B0' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close B0' })); expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('button', { name: 'Close B0' })).not.toBeInTheDocument();
  expect(view.container.querySelector('.fluidContainer')).toBeVisible();
  expect(screenUnderPlayer.style.pointerEvents).toBe('auto');
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

const tiles = (container: HTMLElement) => [...container.querySelectorAll('.embla .embla__slide')];
let cursor = 0;
const move = (element: Element) => fireEvent.mouseMove(element, { clientX: (cursor += 1), clientY: 10 });

test('home follows the pointer in the first row without scrolling it and opens a tile on click', async () => {
  const callbacks = props(); const view = render(<Home {...callbacks} />); await tick();
  carousel.scrollTo.mockClear();
  move(tiles(view.container)[1]);
  expect(tiles(view.container)[1]).toHaveClass('active');
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  expect(carousel.scrollTo).not.toHaveBeenCalled();
  expect(carousel.options.startIndex).toBe(0);
  fireEvent.mouseMove(tiles(view.container)[2], { clientX: cursor, clientY: 10 });
  expect(carousel.options.startIndex).toBe(0);
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  key('ArrowRight'); expect(screen.getByTestId('preview')).toHaveTextContent('C0');
  expect(carousel.scrollTo).toHaveBeenLastCalledWith(2, true);
  expect(carousel.options.startIndex).toBe(0);
  fireEvent.click(tiles(view.container)[0]);
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Close A0' })).toBeInTheDocument();
});

test('hovering a tile of any row selects it and its row, and a click opens it', async () => {
  const callbacks = props(); const view = render(<Home {...callbacks} />); await tick();
  move(tiles(view.container)[1]);
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  move(tiles(view.container)[4]);
  expect(tiles(view.container)[4]).toHaveClass('active');
  expect(tiles(view.container)[1]).not.toHaveClass('active');
  expect(screen.getByTestId('preview')).toHaveTextContent('B1');
  move(tiles(view.container)[3]);
  expect(screen.getByTestId('preview')).toHaveTextContent('A1');
  move(tiles(view.container)[1]);
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  move(tiles(view.container)[7]);
  fireEvent.click(tiles(view.container)[8]);
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Close C2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close C2' }));
  expect(screen.getByTestId('preview')).toHaveTextContent('C2');
  key('ArrowUp'); await tick();
  expect(screen.getByTestId('preview')).toHaveTextContent('A1');
  key('ArrowLeft'); expect(screen.getByTestId('preview')).toHaveTextContent('A1');
});

test('home opens and follows tiles of the continue watching row with the pointer', async () => {
  const entries = ['saved-a', 'saved-b'].map(guid => ({ event: talk({ guid, title: guid }), conferenceTitle: 'Saved conference', positionSeconds: 100, durationSeconds: 600 }));
  replacePlaybackHistory(entries);
  const callbacks = props(); const view = render(<Home {...callbacks} />); await tick();
  move(tiles(view.container)[1]);
  expect(screen.getByTestId('preview')).toHaveTextContent('saved-b');
  fireEvent.click(tiles(view.container)[1]);
  expect(screen.getByRole('button', { name: 'Close saved-b' })).toBeInTheDocument();
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
});

const scroller = (container: HTMLElement) => container.querySelector('.homeRows') as HTMLElement;
const layout = (element: HTMLElement, height = 400) => {
  const list = element.firstElementChild as HTMLElement;
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: height * list.children.length });
  [...list.children].forEach((row, index) => { (row as HTMLElement).getBoundingClientRect = () => ({ top: index * height - element.scrollTop, bottom: 0, left: 0, right: 0, width: 0, height, x: 0, y: 0, toJSON: () => ({}) }); });
  element.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
};

test('home rows scroll natively and the remote moves the selected row to the top', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  expect(rowsView).toHaveAttribute('data-wheel', 'scroll');
  expect(rowsView).toHaveAttribute('data-wheel-main');
  layout(rowsView);
  key('ArrowDown'); await tick();
  expect(rowsView.scrollTop).toBe(400);
  expect(screen.getByTestId('preview')).toHaveTextContent('A1');
  key('ArrowDown'); await tick();
  expect(rowsView.scrollTop).toBe(800);
  key('ArrowUp'); await tick();
  expect(rowsView.scrollTop).toBe(400);
  move(tiles(view.container)[1]);
  expect(rowsView.scrollTop).toBe(400);
});

test('the home bar can be grabbed, pressing and dragging its thumb scrolls the rows', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  const bar = view.container.querySelector('.homeScroll') as HTMLElement;
  const thumb = view.container.querySelector('.homeScroll__thumb') as HTMLElement;
  expect(thumb.style.height).toBe('0%');
  layout(rowsView);
  Object.defineProperty(rowsView, 'clientHeight', { configurable: true, value: 700 });
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 2800 });
  fireEvent.scroll(rowsView);
  const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 10, width: 10, height, x: 0, y: top, toJSON: () => ({}) });
  bar.getBoundingClientRect = () => rect(0, 1000);
  thumb.getBoundingClientRect = () => rect(0, 250);
  fireEvent.mouseDown(bar, { clientY: 100 });
  fireEvent.mouseMove(window, { clientY: 400 });
  expect(rowsView.scrollTop).toBe(840);
  fireEvent.mouseDown(bar, { clientY: 900 });
  expect(rowsView.scrollTop).toBe(2100);
  fireEvent.mouseUp(window);
  fireEvent.mouseMove(window, { clientY: 100 });
  expect(rowsView.scrollTop).toBe(2100);
  fireEvent.mouseDown(bar, { clientY: 10 });
  view.unmount();
  fireEvent.mouseMove(window, { clientY: 600 });
});

test('the home bar thumb follows the scrolled rows along the whole screen height', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  const thumb = view.container.querySelector('.homeScroll__thumb') as HTMLElement;
  expect(view.container.querySelector('.homeScroll')).toHaveAttribute('aria-hidden', 'true');
  layout(rowsView);
  Object.defineProperty(rowsView, 'clientHeight', { configurable: true, value: 700 });
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 2800 });
  fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.height)).toBe(25);
  expect(parseFloat(thumb.style.top)).toBe(0);
  rowsView.scrollTop = 1050; fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.top)).toBeCloseTo(37.5);
  rowsView.scrollTop = 2100; fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.top) + parseFloat(thumb.style.height)).toBeCloseTo(100);
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 700 });
  fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.height)).toBe(0);
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 70000 });
  fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.height)).toBe(8);
});

test('scrolling the rows with the wheel keeps the selection until the pointer picks another tile', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  layout(rowsView);
  move(tiles(view.container)[1]);
  rowsView.scrollTop = 900; fireEvent.scroll(rowsView);
  expect(screen.getByTestId('preview')).toHaveTextContent('B0');
  expect(tiles(view.container)[1]).toHaveClass('active');
  move(tiles(view.container)[7]);
  expect(screen.getByTestId('preview')).toHaveTextContent('B2');
});

test('only the rows near the screen load their thumbnails', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  layout(rowsView);
  const loaded = () => [...view.container.querySelectorAll('.embla__container_vertical > .embla__slide')].map(row => row.querySelectorAll('img[src]').length);
  expect(loaded()).toEqual([2, 2, 2, 2, 0, 0, 0]);
  rowsView.scrollTop = 1600; fireEvent.scroll(rowsView);
  expect(loaded().slice(0, 7)).toEqual([2, 0, 2, 2, 2, 2, 2]);
  key('ArrowDown'); await tick();
  expect(loaded().slice(0, 2)).toEqual([0, 2]);
});

test('rows below the screen are requested when the page is scrolled close to the last one', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  layout(rowsView);
  const initial = vi.mocked(fetch).mock.calls.length;
  rowsView.scrollTop = 1600; fireEvent.scroll(rowsView); await tick();
  expect(fetch).toHaveBeenCalledTimes(initial + 1);
  rowsView.scrollTop = 1700; fireEvent.scroll(rowsView); await tick();
  expect(fetch).toHaveBeenCalledTimes(initial + 1);
  act(() => { updateQuery<RecentData>('recent', () => ({ conferencesRecent: rows(), fetched: 9 })); });
  rowsView.scrollTop = 1750; fireEvent.scroll(rowsView); await tick();
  expect(fetch).toHaveBeenCalledTimes(initial + 2);
});

test('home moves between conference rows with the remote, throttles input, and fetches the next page', async () => {
  const view = render(<Home {...props()} />); await tick();
  key('ArrowUp'); await tick();
  expect(screen.getByTestId('preview')).toHaveTextContent('A0');
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
  const view = render(<EventCarousel eventApis={refs} events={value} activeEvent={0} rowIndex={0} conferenceTitle="Conference" playbackProgressByGuid={new Map([['talk', 25]])} />);
  expect(carousel.scrollTo).toHaveBeenCalledWith(0, true);
  expect(screen.getByLabelText('25% watched')).toBeInTheDocument();
  view.rerender(<EventCarousel eventApis={refs} events={value} activeEvent={2} rowIndex={1} conferenceTitle="Conference" />);
  expect(refs.current[1]).toBe(carousel);
});

test('a row keeps the slides where they are when the pointer moves on to a tile of the row below', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowTiles = (index: number) => [...view.container.querySelectorAll('.embla')[index].querySelectorAll('.embla__slide')];
  carousel.scrollTo.mockClear();
  carousel.starts.length = 0;
  move(rowTiles(0)[2]);
  expect(rowTiles(0)[2]).toHaveClass('active');
  move(rowTiles(1)[1]);
  expect(rowTiles(1)[1]).toHaveClass('active');
  expect(rowTiles(0)[2]).not.toHaveClass('active');
  move(rowTiles(2)[2]);
  move(rowTiles(0)[1]);
  expect(carousel.starts.length).toBeGreaterThan(4);
  expect(carousel.starts.every((start) => start === 0)).toBe(true);
  expect(carousel.scrollTo).not.toHaveBeenCalled();
});

test('the remote moves a row to the tile it selects, also after the pointer chose another one', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowTiles = (index: number) => [...view.container.querySelectorAll('.embla')[index].querySelectorAll('.embla__slide')];
  carousel.scrollTo.mockClear();
  move(rowTiles(0)[1]);
  expect(carousel.scrollTo).not.toHaveBeenCalled();
  key('ArrowRight');
  expect(carousel.scrollTo).toHaveBeenLastCalledWith(2, true);
  key('ArrowLeft');
  expect(carousel.scrollTo).toHaveBeenLastCalledWith(1, true);
});

test('a row is measured once and again only when it gets another number of slides or the window is resized', async () => {
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0));
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => clearTimeout(frame));
  const first = conference({ id: 'grow', title: 'Grow', lectures: { nodes: [talk({ guid: 'g1', title: 'G1' })] } });
  seedQuery('recent', { conferencesRecent: [first] });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => json({ data: { conferencesRecent: JSON.parse(String(init.body)).variables.offset ? [] : [first] } })));
  render(<Home {...props()} />); await tick();
  expect(carousel.options).toMatchObject({ watchResize: false, watchSlides: false, startIndex: 0 });
  carousel.reInit.mockClear();
  key('ArrowRight'); key('ArrowLeft');
  expect(carousel.reInit).not.toHaveBeenCalled();
  act(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); });
  await tick(50);
  expect(carousel.reInit).toHaveBeenCalledTimes(1);
  act(() => { updateQuery<RecentData>('recent', () => ({ conferencesRecent: [{ ...first, lectures: { nodes: [talk({ guid: 'g1', title: 'G1' }), talk({ guid: 'g2', title: 'G2' })] } }] })); });
  await tick(50);
  expect(carousel.reInit).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});

const screenWidth = (matches: boolean) => vi.stubGlobal('matchMedia', () => ({ matches, addListener: vi.fn(), removeListener: vi.fn() }));

test.each([[false, 1, 0], [true, 0, 1]])('on a small screen %s the preview is left out and the tiles carry the description', async (small, previews, described) => {
  screenWidth(small);
  const view = render(<Home {...props()} />);
  await tick();
  expect(screen.queryAllByTestId('preview')).toHaveLength(previews);
  expect(view.container.querySelectorAll('.embla__slide__description').length > 0).toBe(Boolean(described));
  if (small) expect(view.container.querySelector('.embla__slide__description')).toHaveTextContent('Talk description');
});

test('the page below the player keeps the saved positions of the playing talk until the player closes', async () => {
  const entries = ['saved-a', 'saved-b'].map(guid => ({ event: talk({ guid, title: guid }), positionSeconds: 100, durationSeconds: 600 }));
  replacePlaybackHistory(entries);
  const view = render(<Home {...props()} />); await tick();
  expect(view.container.querySelectorAll('.embla__slide__progress')).toHaveLength(2);
  key('Enter');
  expect(screen.getByRole('button', { name: 'Close saved-a' })).toBeInTheDocument();
  act(() => { replacePlaybackHistory([{ ...entries[0], positionSeconds: 300 }, entries[1]]); });
  expect(view.container.querySelector('.embla__slide__progressFill')).toHaveStyle({ width: '16.666666666666664%' });
  fireEvent.click(screen.getByRole('button', { name: 'Close saved-a' }));
  expect(view.container.querySelector('.embla__slide__progressFill')).toHaveStyle({ width: '50%' });
});

test('a key press only renders the two slides whose selection changed', async () => {
  seedQuery('recent', { conferencesRecent: [conference({ id: 'wide', title: 'Wide', lectures: { nodes: Array.from({ length: 8 }, (_, i) => talk({ guid: `w${i}`, title: `W${i}` })) } })] });
  const view = render(<Home {...props()} />); await tick();
  const slides = () => [...view.container.querySelectorAll('.embla .embla__slide')];
  expect(slides().filter((slide) => slide.className.includes('active'))).toHaveLength(1);
  const before = vi.mocked(formatDuration).mock.calls.length;
  key('ArrowRight');
  expect(vi.mocked(formatDuration).mock.calls.length - before).toBe(2);
  expect(slides().filter((slide) => slide.className.includes('active'))).toHaveLength(1);
});

test('a long row builds only the slides around the selected slide, with their pictures, and empty slides keep the length of the row', async () => {
  const long = conference({ id: 'long', title: 'Long', lectures: { nodes: Array.from({ length: 40 }, (_, i) => talk({ guid: `l${i}`, title: `L${i}`, images: { thumbUrl: `https://static.media.ccc.de/l${i}.jpg` } })) } });
  seedQuery('recent', { conferencesRecent: [long] });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => json({ data: { conferencesRecent: JSON.parse(String(init.body)).variables.offset ? [] : [long] } })));
  carousel.slideNodes.mockReturnValue(Array(40).fill(1));
  const view = render(<Home {...props()} />); await tick();
  const loaded = () => [...view.container.querySelectorAll('.embla .embla__slide__img')].map((image) => Number(/l(\d+)\.jpg$/.exec(image.getAttribute('src') || '')?.[1] ?? -1));
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  expect(loaded()).toEqual(range(0, 5));
  expect(view.container.querySelectorAll('.embla .embla__container > .embla__slide')).toHaveLength(40);
  for (let step = 0; step < 7; step++) { key('ArrowRight'); await tick(); }
  expect(loaded()).toEqual(range(2, 12));
  expect(view.container.querySelectorAll('.embla .embla__container > .embla__slide')).toHaveLength(40);
  for (let step = 0; step < 7; step++) { key('ArrowLeft'); await tick(); }
  expect(loaded()).toEqual(range(0, 5));
  carousel.slideNodes.mockReturnValue([1, 2, 3]);
});

test('a row without a title opens its talks with an empty conference title', async () => {
  const untitled = conference({ id: 'untitled', title: '', lectures: { nodes: [talk({ guid: 'only', title: 'Only talk' })] } });
  seedQuery('recent', { conferencesRecent: [untitled] });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => json({ data: { conferencesRecent: JSON.parse(String(init.body)).variables.offset ? [] : [untitled] } })));
  const callbacks = props(); render(<Home {...callbacks} />); await tick();
  key('Enter');
  expect(screen.getByRole('button', { name: 'Close Only talk' })).toBeInTheDocument();
});

test('a carousel without handlers shows its slides and ignores the pointer, and languages alone get the world icon', () => {
  const refs = { current: [] } as React.RefObject<CarouselApi[]>;
  const multilingual = talk({ guid: 'multi', title: 'Multi', subtitles: [], videos: [{ ...talk().videos[0], width: 1920, height: 1080 }, { ...talk().videos[0], width: 1920, height: 1080, language: 'eng', url: 'https://static.media.ccc.de/multi-eng.webm' }] });
  const view = render(<EventCarousel eventApis={refs} events={{ lectures: { nodes: [multilingual] } }} activeEvent={0} rowIndex={0} conferenceTitle="Conference" />);
  const slide = view.container.querySelector('.embla__slide') as HTMLElement;
  fireEvent.mouseMove(slide, { clientX: 20, clientY: 20 });
  fireEvent.click(slide);
  expect(view.container.querySelectorAll('.slide-icon')).toHaveLength(1);
  expect(view.container.querySelector('.slide-icon--mr')).toBeNull();
});

test.each([[false, true], [true, false]])('on a touch screen %s only the picture of a tile opens the player: text opens it %s', async (touch, textOpens) => {
  screenWidth(touch);
  const view = render(<Home {...props()} />); await tick();
  fireEvent.click(view.container.querySelector('.embla .embla__slide .embla__slide__title')!);
  expect(Boolean(screen.queryByRole('button', { name: /^Close/ }))).toBe(textOpens);
  if (!textOpens) {
    fireEvent.click(view.container.querySelector('.embla .embla__slide .embla__slide__media')!);
    expect(screen.getByRole('button', { name: /^Close/ })).toBeInTheDocument();
  }
  vi.unstubAllGlobals();
});

test('in a browser the name of a conference opens its page and the Continue Watching row does not', async () => {
  replacePlaybackHistory([{ event: talk({ guid: 'saved', title: 'Saved' }), positionSeconds: 100, durationSeconds: 600 }]);
  const open = vi.fn();
  const view = render(<Home {...props()} onOpenConference={open} />); await tick();
  const names = [...view.container.querySelectorAll('.carouselTitle')];
  expect(names[0]).toHaveTextContent('Continue Watching');
  expect(names[0]).not.toHaveClass('carouselTitle--link');
  fireEvent.click(names[0]);
  expect(open).not.toHaveBeenCalled();
  expect(names[1]).toHaveClass('carouselTitle--link');
  fireEvent.click(names[1]);
  expect(open).toHaveBeenCalledWith('c0');
});

test('on the TV the conference names are plain text', async () => {
  vi.stubGlobal('PalmServiceBridge', class {});
  const open = vi.fn();
  const view = render(<Home {...props()} onOpenConference={open} />); await tick();
  expect(view.container.querySelector('.carouselTitle--link')).toBeNull();
  fireEvent.click(view.container.querySelector('.carouselTitle')!);
  expect(open).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('rows away from the screen are only a title on a skeleton again, and the rows that come within reach are built before they are seen', async () => {
  const many = Array.from({ length: 14 }, (_, i) => conference({ id: `m${i}`, title: `Many ${i}`, lectures: { nodes: [talk({ guid: `m${i}`, title: `M${i}` })] } }));
  seedQuery('recent', { conferencesRecent: many });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => json({ data: { conferencesRecent: JSON.parse(String(init.body)).variables.offset ? [] : many } })));
  const view = render(<Home {...props()} />); await tick();
  const placeholders = () => [...view.container.querySelectorAll('.rowPlaceholder')].map((row) => row.textContent);
  expect(placeholders()).toEqual(['Many 4', 'Many 5', 'Many 6', 'Many 7', 'Many 8', 'Many 9', 'Many 10', 'Many 11', 'Many 12', 'Many 13']);
  const rowsView = scroller(view.container);
  layout(rowsView);
  rowsView.scrollTop = 1600; fireEvent.scroll(rowsView);
  expect(placeholders()).toEqual(['Many 1', 'Many 8', 'Many 9', 'Many 10', 'Many 11', 'Many 12', 'Many 13']);
  rowsView.scrollTop = 4000; fireEvent.scroll(rowsView);
  expect(placeholders()).toEqual(['Many 1', 'Many 2', 'Many 3', 'Many 4', 'Many 5', 'Many 6', 'Many 7', 'Many 8']);
  expect(view.container.querySelectorAll('.embla').length).toBeLessThanOrEqual(7);
  rowsView.scrollTop = 0; fireEvent.scroll(rowsView);
  expect(placeholders()).toEqual(['Many 4', 'Many 5', 'Many 6', 'Many 7', 'Many 8', 'Many 9', 'Many 10', 'Many 11', 'Many 12', 'Many 13']);
  vi.unstubAllGlobals();
});

test('the grip of the home bar keeps its size while it is held and fits the rows again when it is let go', async () => {
  const view = render(<Home {...props()} />); await tick();
  const rowsView = scroller(view.container);
  const bar = view.container.querySelector('.homeScroll') as HTMLElement;
  const thumb = view.container.querySelector('.homeScroll__thumb') as HTMLElement;
  layout(rowsView);
  Object.defineProperty(rowsView, 'clientHeight', { configurable: true, value: 700 });
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 2800 });
  fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.height)).toBe(25);
  const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 10, width: 10, height, x: 0, y: top, toJSON: () => ({}) });
  bar.getBoundingClientRect = () => rect(0, 1000);
  thumb.getBoundingClientRect = () => rect(0, 250);
  fireEvent.mouseDown(bar, { clientY: 100 });
  Object.defineProperty(rowsView, 'scrollHeight', { configurable: true, value: 5600 });
  fireEvent.mouseMove(window, { clientY: 500 });
  fireEvent.scroll(rowsView);
  expect(parseFloat(thumb.style.height)).toBe(25);
  expect(rowsView.scrollTop).toBeCloseTo((400 / 750) * 4900);
  fireEvent.mouseUp(window);
  expect(parseFloat(thumb.style.height)).toBe(12.5);
});
