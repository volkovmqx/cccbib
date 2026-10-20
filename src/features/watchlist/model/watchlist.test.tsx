import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { talk } from '../../../../tests/fixtures';
import { readWatchlist, writeWatchlist, addToWatchlistStore, removeFromWatchlistStore } from './watchlist';
import { useWatchlist } from './useWatchlist';

test('watchlist changes are persistent, unique, and observable', () => {
  const update = vi.fn();
  window.addEventListener('watchlistUpdate', update);
  const item = talk();
  expect(readWatchlist()).toEqual([]);
  expect(addToWatchlistStore(item)).toBe(true);
  expect(readWatchlist()[0]).toMatchObject(item);
  expect(addToWatchlistStore(item)).toBe(false);
  expect(removeFromWatchlistStore('missing')).toBe(false);
  expect(removeFromWatchlistStore(item.guid)).toBe(true);
  expect(readWatchlist()).toEqual([]);
  writeWatchlist([item]);
  expect(update).toHaveBeenCalledTimes(3);
  window.removeEventListener('watchlistUpdate', update);
});

test('watchlist rejects malformed storage and handles storage failures', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const raw of ['broken', '{}', 'null', '0', '"text"']) {
    localStorage.setItem('watchlist', raw);
    expect(readWatchlist()).toEqual([]);
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  expect(readWatchlist()).toEqual([]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(addToWatchlistStore(talk())).toBe(false);
  expect(removeFromWatchlistStore('talk')).toBe(false);
});

test('watchlist ignores malformed entries and preserves valid saved talks', () => {
  const saved = { ...talk({ description: null }), addedAt: 123 };
  const raw = JSON.stringify([null, {}, { guid: 'incomplete' }, { ...talk(), videos: [null] },
    { ...talk(), addedAt: 'yesterday' }, { ...talk(), addedAt: null }, saved, talk({ guid: 'older' })]);
  localStorage.setItem('watchlist', raw);
  expect(readWatchlist()).toEqual([saved, talk({ guid: 'older' })]);
  expect(localStorage.getItem('watchlist')).toBe(raw);
  expect(addToWatchlistStore(talk({ guid: 'new' }))).toBe(true);
  expect(readWatchlist().map(item => item.guid)).toEqual(['talk', 'older', 'new']);
});

test('watchlist hook follows changes, toggles items, and removes its listener', () => {
  const item = talk();
  const { result, rerender, unmount } = renderHook(({ guid }) => useWatchlist(guid), { initialProps: { guid: item.guid as string | undefined } });
  expect(result.current.isInWatchlist).toBe(false);
  act(() => { expect(result.current.addToWatchlist(item)).toBe(true); });
  expect(result.current.isInWatchlist).toBe(true);
  act(() => { expect(result.current.addToWatchlist(item)).toBe(false); });
  act(() => { expect(result.current.removeFromWatchlist('missing')).toBe(false); });
  act(() => { result.current.toggleWatchlist(item); });
  expect(result.current.isInWatchlist).toBe(false);
  act(() => { result.current.toggleWatchlist(item); });
  rerender({ guid: undefined });
  expect(result.current.isInWatchlist).toBe(false);
  rerender({ guid: 'other' });
  expect(result.current.isInWatchlist).toBe(false);
  const remove = vi.spyOn(window, 'removeEventListener');
  unmount();
  expect(remove).toHaveBeenCalledWith('watchlistUpdate', expect.any(Function));
});

test('watchlist removal reports a write failure', () => {
  addToWatchlistStore(talk());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(removeFromWatchlistStore('talk')).toBe(false);
});
