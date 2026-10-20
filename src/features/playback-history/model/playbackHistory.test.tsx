import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { talk } from '../../../../tests/fixtures';
import { getSavedPlaybackPosition, readPlaybackHistory, removePlaybackHistoryItem, replacePlaybackHistory, savePlaybackHistoryItem } from './playbackHistory';
import { usePlaybackHistory } from './usePlaybackHistory';

const input = (positionSeconds = 120, guid = 'talk') => ({ event: talk({ guid }), positionSeconds, durationSeconds: 600 });

test('history records only useful positions and removes completed talks', () => {
  expect(readPlaybackHistory()).toEqual([]);
  for (const position of [0, -1, NaN, Infinity, 9]) expect(savePlaybackHistoryItem(input(position))).toBe(false);
  expect(savePlaybackHistoryItem({ ...input(), durationSeconds: 0 })).toBe(false);
  expect(savePlaybackHistoryItem({ ...input(), event: talk({ guid: '' }) })).toBe(false);
  expect(savePlaybackHistoryItem(input())).toBe(true);
  expect(getSavedPlaybackPosition('talk')).toBe(120);
  expect(readPlaybackHistory()[0].conferenceTitle).toBe('Test conference');
  expect(savePlaybackHistoryItem(input(5))).toBe(true);
  expect(savePlaybackHistoryItem(input(570))).toBe(true);
  expect(readPlaybackHistory()).toEqual([]);
  expect(removePlaybackHistoryItem('missing')).toBe(false);
  expect(removePlaybackHistoryItem('')).toBe(false);
});

test('history normalizes old entries, sorts by update time, and limits entries', () => {
  const items = Array.from({ length: 24 }, (_, i) => ({ ...input(30, String(i)), conferenceTitle: '', updatedAt: i }));
  localStorage.setItem('continue_watching', JSON.stringify({ version: 1, items: [null, {}, { ...input(), event: null },
    { ...input(), event: { guid: 'incomplete' } }, { ...input(), event: { ...talk(), persons: 'Speaker' } },
    { ...input(), positionSeconds: -1 }, { ...input(), durationSeconds: 0 }, { ...input(590) }, ...items] }));
  expect(readPlaybackHistory()).toHaveLength(20);
  expect(readPlaybackHistory()[0].event.guid).toBe('23');
  expect(readPlaybackHistory()[0].conferenceTitle).toBe('Test conference');
  replacePlaybackHistory([input(50, 'first'), input(60, 'second')]);
  expect(readPlaybackHistory().map(x => x.event.guid)).toEqual(['first', 'second']);
  localStorage.setItem('continue_watching', JSON.stringify({ version: 1, items: [{ ...input(), conferenceTitle: '', event: talk({ conference_title: undefined }), updatedAt: -1 }] }));
  expect(readPlaybackHistory()[0]).toMatchObject({ updatedAt: 0, conferenceTitle: '' });
  localStorage.setItem('continue_watching', JSON.stringify({ version: 1,
    items: [{ ...input(), conferenceTitle: {}, updatedAt: 1 }] }));
  expect(readPlaybackHistory()[0].conferenceTitle).toBe('Test conference');
});

test('history validates the stored format and handles denied storage', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const value of ['bad', '{}', 'null', '{"version":2,"items":[]}', '{"version":1,"items":{}}']) {
    localStorage.setItem('continue_watching', value);
    expect(readPlaybackHistory()).toEqual([]);
  }
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(savePlaybackHistoryItem(input())).toBe(false);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  expect(readPlaybackHistory()).toEqual([]);
  expect(getSavedPlaybackPosition('talk')).toBe(0);
});

test('legacy resume positions work until a position is stored or removed', () => {
  expect(getSavedPlaybackPosition()).toBe(0);
  expect(getSavedPlaybackPosition('')).toBe(0);
  for (const value of ['bad', '0', '-5', 'Infinity']) {
    localStorage.setItem('playback_position_talk', value);
    expect(getSavedPlaybackPosition('talk')).toBe(0);
  }
  localStorage.setItem('playback_position_talk', '100');
  expect(getSavedPlaybackPosition('talk')).toBe(100);
  savePlaybackHistoryItem(input());
  expect(localStorage.getItem('playback_position_talk')).toBeNull();
  localStorage.setItem('playback_position_talk', '100');
  removePlaybackHistoryItem('talk');
  expect(localStorage.getItem('playback_position_talk')).toBeNull();
});

test('history hook responds to local updates and matching storage events', () => {
  const { result, unmount } = renderHook(usePlaybackHistory);
  act(() => { savePlaybackHistoryItem(input()); });
  expect(result.current).toHaveLength(1);
  localStorage.removeItem('continue_watching');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'other' })); });
  expect(result.current).toHaveLength(1);
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'continue_watching' })); });
  expect(result.current).toEqual([]);
  localStorage.setItem('continue_watching', JSON.stringify({ version: 1, items: [{ ...input(), updatedAt: 1 }] }));
  act(() => { window.dispatchEvent(new StorageEvent('storage')); });
  expect(result.current).toHaveLength(1);
  const remove = vi.spyOn(window, 'removeEventListener');
  unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
