import { act, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { Talk } from '@/entities/talk';
import { conference, json, talk } from '../../../../tests/fixtures';
import Conference from './Conference';
import { setSetting } from '@/shared/config';

vi.mock('@/widgets/player', () => ({ Player: ({ event }: { event: Talk }) => <div>Playing {event.title}</div> }));
vi.mock('@/widgets/talk-preview', () => ({ Preview: ({ event }: { event: Talk }) => <div>{event?.title}</div> }));

const props = (conferenceId: string) => ({ conferenceId, onClose: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false, setIsPlayerFullscreen: vi.fn() });
const page = (guids: string[], next: string | null) => json({ data: { conference: conference({ lectures: {
  nodes: guids.map((guid) => talk({ guid, title: `Talk ${guid}` })),
  pageInfo: { hasNextPage: next !== null, endCursor: next },
} }) } });

test('a conference with more talks than one page keeps asking for the next page until the grid holds all of them', async () => {
  setSetting('uiLanguage', 'en');
  const request = vi.fn()
    .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
    .mockResolvedValueOnce(page(['c', 'd'], 'c2'))
    .mockResolvedValueOnce(page(['e'], null));
  vi.stubGlobal('fetch', request);
  render(<Conference {...props('long')} />);
  await screen.findByText('Talk e');
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls.map(([, init]) => JSON.parse(init.body).variables)).toEqual([{ id: 'long' }, { id: 'long', after: 'c1' }, { id: 'long', after: 'c2' }]);
  for (const guid of ['a', 'b', 'c', 'd', 'e']) expect(screen.getAllByText(`Talk ${guid}`).length).toBeGreaterThan(0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(request).toHaveBeenCalledTimes(3);
});

const settle = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

test('a page that fails to load is asked for again after a few seconds, and the grid keeps the talks it has meanwhile', async () => {
  vi.useFakeTimers();
  setSetting('uiLanguage', 'en');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const request = vi.fn().mockResolvedValueOnce(page(['a'], 'c1')).mockRejectedValueOnce(Error('Offline')).mockResolvedValueOnce(page(['b'], null));
  vi.stubGlobal('fetch', request);
  render(<Conference {...props('retry')} />);
  await settle(0);
  expect(error).toHaveBeenCalledWith('Failed to fetch more talks:', expect.any(Error));
  expect(screen.getAllByText('Talk a').length).toBeGreaterThan(0);
  expect(request).toHaveBeenCalledTimes(2);
  await settle(2999);
  expect(request).toHaveBeenCalledTimes(2);
  await settle(1);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls.map(([, init]) => JSON.parse(init.body).variables.after)).toEqual([undefined, 'c1', 'c1']);
  expect(screen.getAllByText('Talk b').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Talk a').length).toBeGreaterThan(0);
});

test('a page that keeps failing is tried three more times and then left alone', async () => {
  vi.useFakeTimers();
  setSetting('uiLanguage', 'en');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const request = vi.fn().mockResolvedValueOnce(page(['a'], 'c1')).mockRejectedValue(Error('Offline'));
  vi.stubGlobal('fetch', request);
  render(<Conference {...props('giveup')} />);
  for (let step = 0; step < 6; step += 1) await settle(3000);
  expect(request).toHaveBeenCalledTimes(5);
  expect(screen.getAllByText('Talk a').length).toBeGreaterThan(0);
});
