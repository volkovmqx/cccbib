import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFocusedTalk, type Talk } from '@/entities/talk';
import { conference, json, talk } from '../../../tests/fixtures';
import Popular from '@/pages/popular';
import Conferences from '@/pages/conferences';
import Conference from '@/pages/conference';
import Watchlist from '@/pages/watchlist';
import { writeWatchlist } from '@/features/watchlist';
import { setSetting } from '@/shared/config';

const query = vi.hoisted(() => ({ data: undefined as unknown, error: null as Error | null }));
vi.mock('@/shared/api', async importOriginal => ({ ...await importOriginal<typeof import('@/shared/api')>(), useQuery: () => query }));
vi.mock('@/widgets/player', () => ({ Player: ({ event, onClose }: { event: Talk; onClose: () => void }) => <button onClick={onClose}>Close {event.title}</button> }));
vi.mock('@/widgets/talk-preview', () => ({ Preview: ({ event }: { event: Talk }) => <div data-testid="preview">{event?.title}</div> }));
const props = () => ({ onClose: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false, setIsPlayerFullscreen: vi.fn() });
beforeEach(() => { query.data = undefined; query.error = null; setSetting('uiLanguage', 'en'); });
afterEach(() => { vi.restoreAllMocks(); });
const layoutRows = () => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(0);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(700);
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1200);
};
const manyTalks = (count: number) => ({ conference: conference({ lectures: { nodes: Array.from({ length: count }, (_, index) => talk({ guid: String(index), title: `Talk ${index}` })) } }) });
const renderedTitles = (container: HTMLElement) => [...container.querySelectorAll('.conferenceView__gridItem__title')].map((title) => title.textContent);

test('popular page handles loading, errors, empty data, ranking, and player transitions', () => {
  const callbacks = props();
  const view = render(<Popular {...callbacks} />);
  expect(screen.getByRole('status')).toBeVisible();
  query.error = Error('Offline'); view.rerender(<Popular {...callbacks} sidebarFocused />);
  expect(screen.getByText('Error: Offline')).toBeVisible();
  query.error = null; query.data = {}; view.rerender(<Popular {...callbacks} />);
  expect(screen.getByText('No videos found')).toBeVisible();
  query.data = { conferencesRecent: [conference(), conference({ id: 'later', updatedAt: '2026-01-01', eventLastReleasedAt: '2026-02-01', lectures: { nodes: [talk({ guid: 'b', title: 'Popular', viewCount: 100 }), talk({ guid: 'c', title: 'Sparse', viewCount: 0, persons: [], duration: 0, images: {}, conference_title: '' })] } })] };
  view.rerender(<Popular {...callbacks} sidebarFocused />);
  expect(view.container.querySelector('.listItem')).toHaveTextContent('Popular');
  fireEvent.click(screen.getByText('Popular'));
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByText('Close Popular'));
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  view.rerender(<Popular {...callbacks} />);
  fireEvent.keyDown(window, { key: 'Escape' }); expect(callbacks.onClose).toHaveBeenCalled();
});

test('popular page ranks equal view counts by the newest conference and puts missing counts last', () => {
  const older = conference({ id: 'older', updatedAt: '2025-01-01', lectures: { nodes: [talk({ guid: 'old', title: 'Older talk', viewCount: 5 }), talk({ guid: 'none', title: 'No counts', viewCount: undefined })] } });
  const undated = conference({ id: 'undated', lectures: { nodes: [talk({ guid: 'undated', title: 'Undated talk', viewCount: 5 })] } });
  const newer = conference({ id: 'newer', updatedAt: '2026-01-01', lectures: { nodes: [talk({ guid: 'new', title: 'Newer talk', viewCount: 5 })] } });
  query.data = { conferencesRecent: [older, undated, newer] };
  const view = render(<Popular {...props()} />);
  const text = view.container.textContent!;
  const positions = ['Newer talk', 'Older talk', 'Undated talk', 'No counts'].map(title => text.indexOf(title));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test('watchlist page follows storage changes and restores the list after playback', () => {
  const callbacks = props();
  const view = render(<Watchlist {...callbacks} />);
  expect(screen.getByText('Your watchlist is empty')).toBeVisible();
  act(() => { writeWatchlist([talk()]); });
  expect(screen.getByText('1 video')).toBeVisible();
  act(() => { writeWatchlist([talk(), talk({ guid: 'second', title: 'Sparse', images: {}, conference_title: undefined })]); });
  expect(screen.getByText('2 videos')).toBeVisible();
  fireEvent.click(screen.getByText('Sparse'));
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenCalledWith(true);
  expect(view.container.querySelector('.pageUnderPlayer')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Close Sparse'));
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  expect(view.container.querySelector('.pageUnderPlayer')).not.toBeInTheDocument();
  act(() => { localStorage.removeItem('watchlist'); window.dispatchEvent(new StorageEvent('storage')); });
  expect(screen.getByText('Your watchlist is empty')).toBeVisible();
  view.unmount();
});

test('watchlist page opens with the saved talks and never shows the empty message first', () => {
  writeWatchlist([talk()]);
  const painted: string[] = [];
  render(<Profiler id="watchlist" onRender={() => painted.push(document.body.textContent || '')}><Watchlist {...props()} /></Profiler>);
  expect(painted[0]).toContain('Test talk');
  expect(painted[0]).not.toContain('Your watchlist is empty');
});

const reachRows = () => {
  const observers: { callback: IntersectionObserverCallback }[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(public callback: IntersectionObserverCallback) { observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  return (row: Element) => act(() => observers[observers.length - 1].callback([{ target: row, isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver));
};

test('popular and watchlist load a thumbnail only once its row is within reach of the list', () => {
  const reach = reachRows();
  query.data = { conferencesRecent: [conference({ lectures: { nodes: [talk({ guid: 'p1', title: 'First popular', viewCount: 9 }), talk({ guid: 'p2', title: 'Second popular', viewCount: 8 })] } })] };
  const popular = render(<Popular {...props()} />);
  const thumbs = () => [...popular.container.querySelectorAll('.popularView__thumbnail')].map((image) => [image.getAttribute('src'), image.getAttribute('alt')]);
  expect(thumbs()).toEqual([[null, ''], [null, '']]);
  reach(popular.container.querySelectorAll('.listItem')[1]);
  expect(thumbs()).toEqual([[null, ''], ['https://static.media.ccc.de/thumb.svg', 'Second popular']]);
  popular.unmount();
  writeWatchlist([talk({ guid: 'w1', title: 'First saved' })]);
  const watchlist = render(<Watchlist {...props()} />);
  const saved = () => [...watchlist.container.querySelectorAll('.watchlistView__thumbnail')].map((image) => [image.getAttribute('src'), image.getAttribute('alt')]);
  expect(saved()).toEqual([[null, '']]);
  reach(watchlist.container.querySelector('.listItem')!);
  expect(saved()).toEqual([['https://static.media.ccc.de/thumb.svg', 'First saved']]);
});

test('the list and grid pages tell which talk the pointer or the remote is on and let go of it with the menu and the player', () => {
  const callbacks = props();
  writeWatchlist([talk(), talk({ guid: 'second', title: 'Sparse' })]);
  const list = render(<Watchlist {...callbacks} />);
  expect(readFocusedTalk()?.title).toBe('Test talk');
  fireEvent.mouseMove(screen.getByText('Sparse'), { clientX: 201, clientY: 202 });
  expect(readFocusedTalk()?.title).toBe('Sparse');
  list.rerender(<Watchlist {...callbacks} sidebarFocused />);
  expect(readFocusedTalk()).toBeNull();
  list.rerender(<Watchlist {...callbacks} />);
  fireEvent.click(screen.getByText('Sparse'));
  expect(readFocusedTalk()).toBeNull();
  list.unmount();
  query.data = { conference: conference({ lectures: { nodes: [talk({ guid: '0', title: 'Talk 0' }), talk({ guid: '1', title: 'Talk 1' })] } }) };
  const grid = render(<Conference {...callbacks} conferenceId="conf" />);
  expect(readFocusedTalk()?.title).toBe('Talk 0');
  fireEvent.mouseMove(grid.container.querySelectorAll('.conferenceView__gridItem')[1], { clientX: 301, clientY: 302 });
  expect(readFocusedTalk()?.title).toBe('Talk 1');
  grid.unmount();
  expect(readFocusedTalk()).toBeNull();
});

test('conference list sorts recent dates and selects the conference acronym', async () => {
  const callbacks = { ...props(), onSelectEvent: vi.fn(), selectedIndex: 0, setSelectedIndex: vi.fn() };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ conferences: [
    { title: 'Old', acronym: 'old', updated_at: '2020-01-01' },
    { title: 'New', acronym: 'new', event_last_released_at: '2026-01-01', logo_url: 'logo' },
    { title: 'Undated', acronym: '' },
  ] })));
  const view = render(<Conferences {...callbacks} />);
  expect(screen.getByRole('status')).toBeVisible();
  await screen.findByText('New');
  expect(view.container.querySelector('.listItem')).toHaveTextContent('New');
  fireEvent.click(screen.getByText('New'));
  expect(callbacks.onSelectEvent).toHaveBeenCalledWith('new');
});

test('conference list loads a logo once its row is within reach of the list and draws it only if it is small enough to decode', async () => {
  const observers: { callback: IntersectionObserverCallback }[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(public callback: IntersectionObserverCallback) { observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  const probes: { src: string; naturalWidth: number; naturalHeight: number; onload: (() => void) | null }[] = [];
  vi.stubGlobal('Image', class {
    src = ''; naturalWidth = 0; naturalHeight = 0; onload: (() => void) | null = null;
    constructor() { probes.push(this); }
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ conferences: [
    { title: 'First', acronym: 'first', event_last_released_at: '2026-02-01', logo_url: 'first.png' },
    { title: 'Second', acronym: 'second', event_last_released_at: '2026-01-01', logo_url: 'second.png' },
  ] })));
  const view = render(<Conferences {...props()} onSelectEvent={vi.fn()} selectedIndex={0} setSelectedIndex={vi.fn()} />);
  await screen.findByText('First');
  const logos = () => [...view.container.querySelectorAll('.eventsListView__logo')].map((logo) => [logo.tagName, logo.getAttribute('src'), logo.getAttribute('alt')]);
  const reach = (row: number) => act(() => observers[0].callback([{ target: view.container.querySelectorAll('.listItem')[row], isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(probes).toHaveLength(0);
  expect(logos()).toEqual([['DIV', null, null], ['DIV', null, null]]);
  reach(0);
  expect(probes.map((probe) => probe.src)).toEqual(['first.png']);
  expect(logos()).toEqual([['DIV', null, null], ['DIV', null, null]]);
  Object.assign(probes[0], { naturalWidth: 1000, naturalHeight: 1000 });
  act(() => probes[0].onload!());
  expect(logos()).toEqual([['IMG', 'first.png', 'First'], ['DIV', null, null]]);
  reach(1);
  Object.assign(probes[1], { naturalWidth: 7924, naturalHeight: 3960 });
  act(() => probes[1].onload!());
  expect(probes.map((probe) => probe.src)).toEqual(['first.png', 'second.png']);
  expect(logos()).toEqual([['IMG', 'first.png', 'First'], ['DIV', null, null]]);
});

test.each([new Error('Network'), 'failure', json({}, 503), json({})])('conference list handles unavailable and empty data', async value => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => value instanceof Response ? Promise.resolve(value) : Promise.reject(value)));
  const view = render(<Conferences {...props()} onSelectEvent={vi.fn()} selectedIndex={0} setSelectedIndex={vi.fn()} />);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(view.container.textContent).toMatch(/Error:|No events found/);
});

test('conference page handles loading, errors, and empty results', () => {
  const callbacks = { ...props(), conferenceId: 'conf' };
  const view = render(<Conference {...callbacks} />);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(screen.getByRole('status')).toBeVisible();
  query.error = Error('Offline'); view.rerender(<Conference {...callbacks} sidebarFocused />);
  expect(screen.getByText('Error: Offline')).toBeVisible();
  query.error = null;
  for (const [index, data] of [{}, { conference: {} }, { conference: conference({ lectures: {} as never }) }, { conference: conference({ lectures: { nodes: [] } }) }].entries()) {
    query.data = data; view.rerender(<Conference key={index} {...callbacks} sidebarFocused={false} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByText('No videos found for this conference.')).toBeVisible();
  }
});

test('conference grid items follow a moving pointer and open the player on click', () => {
  const callbacks = { ...props(), conferenceId: 'conf' };
  query.data = { conference: conference({ lectures: { nodes: Array.from({ length: 6 }, (_, index) => talk({ guid: String(index), title: `Talk ${index}` })) } }) };
  const view = render(<Conference {...callbacks} />);
  const items = () => [...view.container.querySelectorAll('.conferenceView__gridItem')];
  fireEvent.mouseMove(items()[2], { clientX: 51, clientY: 71 });
  expect(items()[2]).toHaveClass('conferenceView__gridItem--active');
  fireEvent.mouseMove(items()[3], { clientX: 51, clientY: 71 });
  expect(items()[2]).toHaveClass('conferenceView__gridItem--active');
  fireEvent.click(items()[4]);
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Close Talk 4' })).toBeInTheDocument();
});

test('a key press in the conference grid renders only the two tiles whose selection changes', () => {
  const reads: Record<string, number> = {};
  const nodes = Array.from({ length: 6 }, (_, index) => {
    const entry = talk({ guid: String(index) });
    Object.defineProperty(entry, 'title', { get() { reads[index] = (reads[index] || 0) + 1; return `Talk ${index}`; } });
    return entry;
  });
  query.data = { conference: conference({ lectures: { nodes } }) };
  render(<Conference {...props()} conferenceId="conf" />);
  const before = { ...reads };
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(Object.keys(reads).filter((index) => reads[index] !== before[index])).toEqual(['0', '1']);
});

test('conference page navigates its virtual grid and restores scroll after the player closes', async () => {
  vi.useFakeTimers();
  const callbacks = { ...props(), conferenceId: 'conf' };
  query.data = { conference: conference({ lectures: { nodes: Array.from({ length: 80 }, (_, index) => talk({ guid: String(index), title: `Talk ${index}`, images: index % 2 ? {} : talk().images })) } }) };
  const view = render(<Conference {...callbacks} />);
  fireEvent.keyDown(window, { key: 'Escape' }); expect(callbacks.onClose).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(400); });
  fireEvent.keyDown(window, { key: 'Escape' }); expect(callbacks.onClose).toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'ArrowLeft' }); expect(callbacks.onFocusSidebar).toHaveBeenCalled();
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', ...Array(15).fill('ArrowDown')]) fireEvent.keyDown(window, { key });
  expect(view.container.querySelectorAll('.conferenceView__gridItem').length).toBeLessThan(80);
  act(() => { vi.advanceTimersByTime(60); });
  const container = view.container.querySelector('.conferenceView__list') || view.container.querySelector('.scrollable');
  if (!container) throw Error('Missing scroll container');
  container.scrollTop = 500;
  fireEvent.scroll(container);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(callbacks.setIsPlayerFullscreen).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(60); });
  container.scrollTop = 500;
  fireEvent.scroll(container);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(true);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('button', { name: /^Close Talk/ }));
  act(() => { vi.advanceTimersByTime(100); });
  expect(container.scrollTop).toBe(500);
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  view.rerender(<Conference {...callbacks} sidebarFocused />);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.queryByRole('button', { name: /^Close Talk/ })).not.toBeInTheDocument();
});

test('the page title names the conference while it is open and returns to the app name when it closes', () => {
  document.title = 'CCCBib';
  query.data = { conference: conference({ title: 'Chaostreff Heidelberg' }) };
  const view = render(<Conference {...props()} conferenceId="conf" />);
  expect(document.title).toBe('CCCBib - Chaostreff Heidelberg');
  view.unmount();
  expect(document.title).toBe('CCCBib');
});

test('scrolling the conference with the wheel or the finger renders the rows in view and shows a loading animation where rows are still missing', () => {
  layoutRows();
  query.data = manyTalks(90);
  const view = render(<Conference {...props()} conferenceId="conf" />);
  const container = view.container.querySelector('.conferenceView__container') as HTMLElement;
  const loaders = () => view.container.querySelectorAll('.conferenceView__gridSpacer .conferenceView__gridLoading [role="status"]').length;
  expect(renderedTitles(view.container)).toContain('Talk 0');
  expect(renderedTitles(view.container)).not.toContain('Talk 60');
  expect(loaders()).toBe(1);
  container.scrollTop = 30 * 316 + 40;
  fireEvent.scroll(container);
  expect(renderedTitles(view.container)).toContain('Talk 60');
  expect(renderedTitles(view.container)).not.toContain('Talk 0');
  expect(loaders()).toBe(2);
  expect(view.container.querySelectorAll('.conferenceView__gridItem').length).toBeLessThan(30);
  container.scrollTop = 44 * 316;
  fireEvent.scroll(container);
  expect(renderedTitles(view.container)).toContain('Talk 89');
  expect(loaders()).toBe(1);
  container.scrollTop = 0;
  fireEvent.scroll(container);
  expect(renderedTitles(view.container)).toContain('Talk 0');
});

test('the conference bar follows the scrolled grid, can be dragged and replaces the native scrollbar', () => {
  layoutRows();
  query.data = manyTalks(90);
  const view = render(<Conference {...props()} conferenceId="conf" />);
  const container = view.container.querySelector('.conferenceView__container') as HTMLElement;
  const bar = view.container.querySelector('.pageScroll') as HTMLElement;
  const thumb = view.container.querySelector('.pageScroll__thumb') as HTMLElement;
  expect(bar).toHaveAttribute('aria-hidden', 'true');
  expect(container.nextElementSibling).toBe(bar);
  Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2800 });
  fireEvent.scroll(container);
  expect(parseFloat(thumb.style.height)).toBe(25);
  expect(parseFloat(thumb.style.top)).toBe(0);
  container.scrollTop = 1050; fireEvent.scroll(container);
  expect(parseFloat(thumb.style.top)).toBeCloseTo(37.5);
  const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 10, width: 10, height, x: 0, y: top, toJSON: () => ({}) });
  bar.getBoundingClientRect = () => rect(0, 1000);
  thumb.getBoundingClientRect = () => rect(0, 250);
  fireEvent.mouseDown(bar, { clientY: 100 });
  fireEvent.mouseMove(window, { clientY: 400 });
  expect(container.scrollTop).toBeCloseTo((300 / 750) * 2100);
  fireEvent.mouseUp(window);
  view.unmount();
});

test('a key after the conference was scrolled away from the selection starts at the row in view, and the selection scrolling along keeps its rows', () => {
  layoutRows();
  query.data = manyTalks(90);
  const view = render(<Conference {...props()} conferenceId="conf" />);
  const container = view.container.querySelector('.conferenceView__container') as HTMLElement;
  const active = () => view.container.querySelector('.conferenceView__gridItem--active .conferenceView__gridItem__title')?.textContent;
  expect(active()).toBe('Talk 0');
  container.scrollTop = 30 * 316 + 40;
  fireEvent.scroll(container);
  expect(active()).toBeUndefined();
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(active()).toBe('Talk 60');
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(active()).toBe('Talk 62');
  for (let step = 0; step < 12; step++) fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(active()).toBe('Talk 86');
  expect(renderedTitles(view.container)).toContain('Talk 86');
  for (let step = 0; step < 20; step++) fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(active()).toBe('Talk 46');
  fireEvent.keyDown(window, { key: 'Escape' });
});

test('the conference grid ignores measurements taken while it is hidden', () => {
  layoutRows();
  query.data = manyTalks(30);
  const view = render(<Conference {...props()} conferenceId="conf" />);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(0);
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(0);
  fireEvent(window, new Event('resize'));
  const container = view.container.querySelector('.conferenceView__container') as HTMLElement;
  container.scrollTop = 6 * 316;
  fireEvent.scroll(container);
  expect(renderedTitles(view.container)).toContain('Talk 12');
});

test.each([[false, 2, 1, 0], [true, 1, 0, 6]])('on a small screen %s the conference grid has %s columns, %s previews and %s described tiles in its window', (small, columns, previews, described) => {
  vi.stubGlobal('matchMedia', () => ({ matches: small, addListener: vi.fn(), removeListener: vi.fn() }));
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(small ? 350 : 1200);
  query.data = { conference: conference({ lectures: { nodes: Array.from({ length: 6 }, (_, index) => talk({ guid: String(index), title: `Talk ${index}` })) } }) };
  const view = render(<Conference {...props()} conferenceId="conf" />);
  expect((view.container.querySelector('.conferenceView__grid') as HTMLElement).style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
  expect(screen.queryAllByTestId('preview')).toHaveLength(previews);
  expect(view.container.querySelectorAll('.conferenceView__gridItem__description')).toHaveLength(described);
});

test.each([[false, true], [true, false]])('in the conference grid on a touch screen %s the title opens the player: %s', (touch, titleOpens) => {
  vi.stubGlobal('matchMedia', () => ({ matches: touch, addListener: vi.fn(), removeListener: vi.fn() }));
  query.data = { conference: conference({ lectures: { nodes: Array.from({ length: 3 }, (_, index) => talk({ guid: String(index), title: `Talk ${index}` })) } }) };
  const callbacks = props();
  const view = render(<Conference {...callbacks} conferenceId="conf" />);
  fireEvent.click(view.container.querySelector('.conferenceView__gridItem__title')!);
  expect(Boolean(screen.queryByRole('button', { name: 'Close Talk 0' }))).toBe(titleOpens);
  if (!titleOpens) {
    fireEvent.click(view.container.querySelector('.conferenceView__gridItem__media')!);
    expect(screen.getByRole('button', { name: 'Close Talk 0' })).toBeInTheDocument();
  }
  vi.unstubAllGlobals();
});
