import { beforeEach, expect, test, vi } from 'vitest';
import { json, talk } from '../../../../tests/fixtures';

let search: typeof import('./search');
beforeEach(async () => { vi.resetModules(); search = await import('./search'); });

test('search normalizes and caches queries and evicts old results', async () => {
  const fetch = vi.fn().mockImplementation(async () => json({ data: { lectureSearch: [talk()] } }));
  vi.stubGlobal('fetch', fetch);
  expect(search.normalizeQuery(' Hello  WORLD ')).toBe('hello world');
  const result = await search.searchLectures(' Hello  WORLD ');
  expect(result[0].guid).toBe('talk');
  expect(await search.searchLectures('hello world')).toBe(result);
  expect(search.getCachedSearch('HELLO world')).toBe(result);
  expect(fetch).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 41; i++) await search.searchLectures(String(i));
  expect(search.getCachedSearch('hello world')).toBeUndefined();
  fetch.mockResolvedValue(json({ data: {} }));
  expect(await search.searchLectures('empty')).toEqual([]);
});

test('search falls back to REST and propagates cancellation and REST failures', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(Error('GraphQL unavailable')).mockResolvedValueOnce(json({ events: [{ guid: 'rest', title: 'REST' }] }));
  vi.stubGlobal('fetch', fetch);
  expect((await search.searchLectures('fallback'))[0].guid).toBe('rest');
  expect(fetch.mock.calls[1][0]).toContain('/events/search?q=fallback');
  const abort = new DOMException('Aborted', 'AbortError');
  fetch.mockRejectedValueOnce(abort);
  await expect(search.searchLectures('abort')).rejects.toBe(abort);
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockRejectedValueOnce(Error('GraphQL')).mockResolvedValueOnce(json({}, 500));
  await expect(search.searchLectures('http')).rejects.toThrow('500');
  fetch.mockRejectedValueOnce(Error('GraphQL')).mockResolvedValueOnce(json({}));
  await expect(search.searchLectures('invalid')).rejects.toThrow('Invalid API');
});
