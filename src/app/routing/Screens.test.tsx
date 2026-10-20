import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { Screens } from './Screens';
import { talk } from '../../../tests/fixtures';
import type { Talk } from '@/entities/talk';
import type { PageProps } from '@/shared/ui';

vi.mock('@/pages/home', () => ({ Home: ({ active, onReady }: { active: boolean; onReady: () => void }) => <div>{active && <button onClick={onReady}>Preload screens</button>}</div> }));
vi.mock('@/pages/search', () => ({ default: ({ onClose, onSelectEvent }: PageProps & { onSelectEvent: (talk: Talk) => void }) => <div><button onClick={onClose}>Close search</button><button onClick={() => onSelectEvent(talk())}>Select talk</button></div> }));
vi.mock('@/pages/conferences', () => ({ default: ({ onClose, onSelectEvent, selectedIndex, setSelectedIndex }: PageProps & { onSelectEvent: (id: string) => void; selectedIndex: number; setSelectedIndex: React.Dispatch<React.SetStateAction<number>> }) => <div>
  <button onClick={onClose}>Close events</button><button onClick={() => onSelectEvent('conf-id')}>Select conference</button><button onClick={() => setSelectedIndex(index => index + 1)}>Index {selectedIndex}</button>
</div> }));
vi.mock('@/pages/conference', () => ({ default: ({ onClose, conferenceId }: PageProps & { conferenceId: string }) => <button onClick={onClose}>Close conference {conferenceId}</button> }));
vi.mock('@/pages/popular', () => ({ default: ({ onClose }: PageProps) => <button onClick={onClose}>Close popular</button> }));
vi.mock('@/pages/watchlist', () => ({ default: ({ onClose }: PageProps) => <button onClick={onClose}>Close watchlist</button> }));
vi.mock('@/pages/settings', () => ({ default: ({ onClose }: PageProps) => <button onClick={onClose}>Close settings</button> }));
vi.mock('@/widgets/player', () => ({ Player: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close player</button> }));

function Harness({ initial, fullscreen }: { initial: string; fullscreen: (value: boolean) => void }) {
  const [selectedItem, onSelectItem] = useState(initial);
  return <>
    {['recent', 'search', 'popular', 'events', 'watchlist', 'settings', 'other-conference', ''].map(item => <button key={item} onClick={() => onSelectItem(item)}>Go {item || 'empty'}</button>)}
    <Screens selectedItem={selectedItem} onSelectItem={onSelectItem} onFocusSidebar={() => {}} sidebarFocused={false} setIsPlayerFullscreen={fullscreen} />
  </>;
}
const settle = async () => act(async () => {});

test('screen loading supports search playback and restores the home screen', async () => {
  const fullscreen = vi.fn();
  render(<Harness initial="search" fullscreen={fullscreen} />);
  await settle();
  fireEvent.click(screen.getByText('Select talk'));
  expect(fullscreen).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByText('Close player'));
  expect(fullscreen).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByText('Select talk'));
  fireEvent.click(screen.getByText('Close search'));
  expect(screen.getByText('Preload screens')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Go search')); await settle();
  expect(screen.queryByText('Close player')).not.toBeInTheDocument();
});

test('screen selection preserves conference position through conference and home screens', async () => {
  render(<Harness initial="events" fullscreen={vi.fn()} />); await settle();
  fireEvent.click(screen.getByText('Index 0'));
  fireEvent.click(screen.getByText('Select conference')); await settle();
  fireEvent.click(screen.getByText('Close conference conf-id')); await settle();
  expect(screen.getByText('Index 1')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Close events'));
  fireEvent.click(screen.getByText('Go events')); await settle();
  expect(screen.getByText('Index 1')).toBeInTheDocument();
});

test('screen preloading and all other screen close actions retain the app navigation model', async () => {
  vi.useFakeTimers();
  const fullscreen = vi.fn();
  render(<Harness initial="recent" fullscreen={fullscreen} />);
  fireEvent.click(screen.getByText('Preload screens'));
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  for (const name of ['popular', 'watchlist', 'settings']) {
    fireEvent.click(screen.getByText(`Go ${name}`)); await settle();
    fireEvent.click(screen.getByText(`Close ${name}`));
    expect(screen.getByText('Preload screens')).toBeInTheDocument();
  }
  fireEvent.click(screen.getByText('Go other-conference')); await settle();
  fireEvent.click(screen.getByText('Close conference other-conference'));
  expect(screen.getByText('Preload screens')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Go empty'));
  expect(screen.getByRole('status')).toBeInTheDocument();
});
