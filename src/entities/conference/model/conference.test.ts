import { expect, test, vi } from 'vitest';
import { conference, talk } from '../../../../tests/fixtures';
import { loadHomeCache, saveHomeCache, clearHomeCache } from './homeCache';
import { mergeRecent } from '../api/queries';

test('conference pages merge without duplicate IDs and preserve the fetched offset', () => {
  const first = conference({ id: '1' });
  const second = conference({ id: '2' });
  const third = conference({ id: '3' });
  expect(mergeRecent(undefined, { conferencesRecent: [first, first] })).toEqual({ conferencesRecent: [first], fetched: 2 });
  const previous = { conferencesRecent: [first, second], fetched: 8 };
  expect(mergeRecent(previous, { conferencesRecent: [second, third] }).conferencesRecent).toEqual([second, third, first]);
  expect(mergeRecent(previous, { conferencesRecent: [second, third] }, 8)).toEqual({ conferencesRecent: [first, second, third], fetched: 10 });
  expect(mergeRecent({ conferencesRecent: [first] }, { conferencesRecent: [third] }, 2).fetched).toBe(3);
});

test('home cache ignores malformed, empty, unchanged, and oversized data', () => {
  clearHomeCache();
  for (const raw of ['bad', '{}', 'null', '[]', '[null]', '[{}]', '[{"title":"Broken","lectures":{"nodes":[null]}}]']) {
    localStorage.setItem('home_cache_v1', raw);
    expect(loadHomeCache()).toBeNull();
  }
  for (const value of [{ ...conference(), title: null }, { ...conference(), id: 1 },
    { ...conference(), updatedAt: [] }, { ...conference(), eventLastReleasedAt: {} },
    { title: 'Missing talks' }]) {
    localStorage.setItem('home_cache_v1', JSON.stringify([value]));
    expect(loadHomeCache()).toBeNull();
  }
  const data = [conference()];
  saveHomeCache(data);
  expect(loadHomeCache()).toEqual(data);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  saveHomeCache(data);
  saveHomeCache([]);
  saveHomeCache([conference({ lectures: { nodes: [talk({ description: 'x'.repeat(1500001) })] } })]);
  expect(write).not.toHaveBeenCalled();
  clearHomeCache();
  expect(loadHomeCache()).toBeNull();
});

test('the home cache is only serialised again when a conference object changed', () => {
  clearHomeCache();
  const first = conference({ id: 'a' });
  const second = conference({ id: 'b' });
  const stringify = vi.spyOn(JSON, 'stringify');
  saveHomeCache([first, second]);
  saveHomeCache([first, second]);
  saveHomeCache([first, second].slice());
  expect(stringify).toHaveBeenCalledTimes(1);
  saveHomeCache([first, { ...second }]);
  expect(stringify).toHaveBeenCalledTimes(2);
  clearHomeCache();
  saveHomeCache([first, second]);
  expect(stringify).toHaveBeenCalledTimes(3);
  stringify.mockRestore();
});

test('home cache handles denied reads and writes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  expect(loadHomeCache()).toBeNull();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(() => saveHomeCache([conference({ id: 'other' })])).not.toThrow();
});
