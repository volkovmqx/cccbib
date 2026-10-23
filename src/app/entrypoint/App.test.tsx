import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import { dispatchCommand, onPlayerCommand } from '@/features/remote-control';
import { fetchTalk } from '@/entities/talk';
import type { Talk } from '@/entities/talk';
import type { RemoteCommand } from '@/features/remote-control';
import { talk } from '../../../tests/fixtures';

const commands = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/app/model', () => ({ LIST_COMMANDS: ['add', 'remove', 'progress', 'progress-set', 'progress-clear'], applyListCommand: commands.list }));
vi.mock('@/entities/talk', async importOriginal => ({ ...await importOriginal<typeof import('@/entities/talk')>(), fetchTalk: vi.fn() }));
vi.mock('../routing/Screens', () => ({ Screens: (props: { selectedItem: string; onFocusSidebar: () => void; onSelectItem: (item: string) => void; setIsPlayerFullscreen: (value: boolean) => void }) => <div>
  <span>Screen {props.selectedItem}</span><button onClick={props.onFocusSidebar}>Focus sidebar</button><button onClick={() => props.onSelectItem('search')}>Open search</button>
  <button onClick={() => props.setIsPlayerFullscreen(true)}>Play on screen</button><button onClick={() => props.setIsPlayerFullscreen(false)}>Stop on screen</button>
</div> }));
vi.mock('@/widgets/player', () => ({ Player: ({ event, onClose }: { event: Talk; onClose: () => void }) => <button onClick={onClose}>Close {event.title}</button> }));
const send = async (command: RemoteCommand) => act(async () => { dispatchCommand(command); });
beforeEach(() => { vi.useFakeTimers(); vi.mocked(fetchTalk).mockResolvedValue(talk()); commands.list.mockReset(); });

test('app switches screens and moves sidebar focus', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const view = render(<App />);
  expect(view.container.firstElementChild).toHaveClass('offline-banner');
  expect(view.container.lastElementChild).toHaveClass('appShell');
  fireEvent.click(screen.getByText('Focus sidebar'));
  expect(view.container.querySelector('.sidebar')).toHaveClass('sidebar--focused');
  fireEvent.click(screen.getByText('Search', { selector: '.sidebarItem__label' }));
  expect(screen.getByText('Screen search')).toBeVisible();
  expect(view.container.querySelector('.sidebar')).not.toHaveClass('sidebar--focused');
  fireEvent.click(screen.getByText('Home'));
  fireEvent.click(screen.getByText('Open search'));
  expect(screen.getByText('Screen search')).toBeVisible();
});

test('the pointer moves focus between the side menu and the screen and the wheel steps through the focused one', () => {
  const view = render(<App />);
  const menu = () => view.container.querySelector('.sidebar')!;
  fireEvent.mouseMove(view.container.querySelector('.appShell__nav')!, { clientX: 20, clientY: 300 });
  expect(menu()).toHaveClass('sidebar--focused');
  fireEvent.mouseMove(view.container.querySelector('.appShell__nav')!, { clientX: 20, clientY: 300 });
  fireEvent.mouseMove(view.container.querySelector('.appShell__main')!, { clientX: 700, clientY: 300 });
  expect(menu()).not.toHaveClass('sidebar--focused');
  fireEvent.mouseMove(view.container.querySelector('.appShell__nav')!, { clientX: 21, clientY: 301 });
  vi.setSystemTime(Date.now() + 500);
  fireEvent(view.container.querySelector('.appShell__nav')!, new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  expect(view.container.querySelector('.sidebarItem--highlighted')).toHaveTextContent('Search');
});

test('a talk playing on a screen leaves the menu and the layout as they are, only a talk from outside replaces the screens', async () => {
  const view = render(<App />);
  const shell = view.container.querySelector('.appShell')!;
  const nav = view.container.querySelector('.appShell__nav')!;
  fireEvent.click(screen.getByText('Play on screen'));
  expect(view.container.querySelector('.appShell__nav')).toBe(nav);
  expect(shell).toHaveClass('appShell--playing');
  expect(shell).not.toHaveClass('appShell--fullscreen');
  fireEvent.click(screen.getByText('Stop on screen'));
  expect(shell).not.toHaveClass('appShell--playing');
  expect(view.container.querySelector('.appShell__nav')).toBe(nav);
  await send({ cmd: 'play', link: 'media.ccc.de/v/talk' });
  expect(shell).toHaveClass('appShell--fullscreen');
  expect(view.container.querySelector('.appShell__nav')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Close Test talk'));
  expect(view.container.querySelector('.appShell__nav')).toBeInTheDocument();
});

test('a wheel notch over the closed side menu expands it before stepping through it', () => {
  const view = render(<App />);
  const nav = view.container.querySelector('.appShell__nav')!;
  const wheel = () => fireEvent(nav, new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  expect(view.container.querySelector('.sidebar')).not.toHaveClass('sidebar--focused');
  wheel();
  expect(view.container.querySelector('.sidebar')).toHaveClass('sidebar--focused');
  expect(view.container.querySelector('.sidebarItem--highlighted')).toHaveTextContent('Home');
  act(() => { vi.advanceTimersByTime(130); });
  wheel();
  expect(view.container.querySelector('.sidebarItem--highlighted')).toHaveTextContent('Search');
});

test('app opens remote talks, queues extras, updates the same talk, and restores its screen', async () => {
  vi.stubGlobal('__cccbibReady', vi.fn());
  const view = render(<App />);
  await send({ cmd: 'play', link: 'media.ccc.de/v/talk', start: 100, aspect: 'zoom', subtitle: 'eng', language: 'deu' });
  expect(screen.getByText('Close Test talk')).toBeVisible();
  expect(view.container.querySelector('.sidebar')).not.toBeInTheDocument();
  expect(window.__cccbibReady).toHaveBeenCalled();
  const player = vi.fn(); const stop = onPlayerCommand(player);
  expect(player.mock.calls.map(call => call[0].cmd)).toEqual(['aspect', 'subtitle', 'language']);
  await send({ cmd: 'play', link: 'media.ccc.de/v/talk', start: 40, aspect: 'stretch' });
  expect(player).toHaveBeenCalledWith({ cmd: 'seek', to: 40 });
  expect(player).toHaveBeenCalledWith({ cmd: 'aspect', value: 'stretch' });
  await send({ cmd: 'play', link: 'media.ccc.de/v/talk' });
  vi.mocked(fetchTalk).mockResolvedValue(talk({ guid: 'other', title: 'Other' }));
  await send({ cmd: 'play', link: 'media.ccc.de/v/other' });
  expect(screen.getByText('Close Other')).toBeVisible();
  fireEvent.click(screen.getByText('Close Other'));
  expect(screen.getByText('Screen recent')).toBeVisible();
  stop();
});

test('app displays remote failures and each list result and clears notices', async () => {
  render(<App />);
  vi.mocked(fetchTalk).mockRejectedValue(Error('404'));
  await send({ cmd: 'play', link: 'missing' });
  expect(screen.getByText('Could not load this talk')).toBeVisible();
  for (const kind of ['none', 'added', 'duplicate', 'removed', 'progress', 'cleared', 'watchlist', 'progressList']) {
    commands.list.mockImplementation(async (_command: RemoteCommand, seek: (position: number) => void) => { seek(10); return { kind, title: 'Result', count: 2 }; });
    await send({ cmd: 'add', link: 'media.ccc.de/v/talk' });
    expect(document.querySelector('.remote-notice')?.textContent).toBeTruthy();
  }
  await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
  expect(document.querySelector('.remote-notice')).not.toBeInTheDocument();
});
