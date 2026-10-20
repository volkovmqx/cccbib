import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Talk } from '@/entities/talk';
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
  fireEvent.click(screen.getByText('Close Sparse'));
  expect(callbacks.setIsPlayerFullscreen).toHaveBeenLastCalledWith(false);
  act(() => { localStorage.removeItem('watchlist'); window.dispatchEvent(new StorageEvent('storage')); });
  expect(screen.getByText('Your watchlist is empty')).toBeVisible();
  view.unmount();
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
  for (const data of [{}, { conference: {} }, { conference: conference({ lectures: { nodes: [] } }) }]) {
    query.data = data; view.rerender(<Conference {...callbacks} sidebarFocused={false} />);
    expect(screen.getByText('No videos found for this conference.')).toBeVisible();
  }
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
