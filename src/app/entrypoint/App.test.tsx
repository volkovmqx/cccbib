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
vi.mock('../routing/Screens', () => ({ Screens: (props: { selectedItem: string; onFocusSidebar: () => void; onSelectItem: (item: string) => void }) => <div>
  <span>Screen {props.selectedItem}</span><button onClick={props.onFocusSidebar}>Focus sidebar</button><button onClick={() => props.onSelectItem('search')}>Open search</button>
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
