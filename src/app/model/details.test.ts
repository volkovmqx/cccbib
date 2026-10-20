import { expect, test, vi } from 'vitest';
import { json, talk } from '../../../tests/fixtures';
import { backfillTalkDetails } from './talkDetails';
import { buildReport, talkLink } from './report';
import { readWatchlist, writeWatchlist } from '@/features/watchlist';
import { readPlaybackHistory, replacePlaybackHistory } from '@/features/playback-history';
import { setNowPlayingReader } from '@/widgets/player/model/nowPlaying';

test('details backfill updates old watchlist and history records without changing progress', async () => {
  const old = talk({ slug: undefined, videos: [{ ...talk().videos[0], height: undefined }] });
  const complete = talk({ guid: 'complete', detailsChecked: true });
  writeWatchlist([old, complete]);
  replacePlaybackHistory([{ event: old, positionSeconds: 100, durationSeconds: 600 }, { event: complete, positionSeconds: 120, durationSeconds: 600 }]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ slug: 'found', recordings: [
    { recording_url: old.videos[0].url, height: 480 }, { recording_url: 'unused', height: 0 }, {},
  ] })));
  const updated = vi.fn(); window.addEventListener('playbackHistoryUpdate', updated);
  await backfillTalkDetails();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(readWatchlist()[0]).toMatchObject({ slug: 'found', detailsChecked: true, videos: [{ height: 480 }] });
  expect(readPlaybackHistory()[0].positionSeconds).toBe(100);
  expect(readPlaybackHistory()[1].event).toEqual(complete);
  expect(updated).toHaveBeenCalledTimes(1);
  window.removeEventListener('playbackHistoryUpdate', updated);
});

test('details backfill tolerates failed requests and invalid saved history', async () => {
  const old = talk({ slug: undefined });
  writeWatchlist([old]);
  const fetch = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}));
  vi.stubGlobal('fetch', fetch);
  for (const raw of ['bad', '{}', 'null']) {
    localStorage.setItem('continue_watching', raw); await backfillTalkDetails();
  }
  expect(readWatchlist()[0].detailsChecked).toBe(true);
  expect(readWatchlist()[0].videos).toEqual(old.videos);
  writeWatchlist([]); await backfillTalkDetails(); expect(fetch).toHaveBeenCalledTimes(3);
});

test('details backfill limits requests and merges into the latest stored data', async () => {
  const pending = Array.from({ length: 42 }, (_, index) => talk({ guid: String(index), slug: undefined, videos: [{ ...talk().videos[0], height: undefined }] }));
  writeWatchlist(pending);
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    if (readWatchlist().length === 42) writeWatchlist([talk({ guid: '0', slug: 'changed', videos: pending[0].videos }), talk({ guid: 'new' }), talk({ guid: '1', detailsChecked: true })]);
    return json({ slug: 'found', recordings: [{ recording_url: pending[0].videos[0].url, height: 480 }] });
  }));
  await backfillTalkDetails();
  expect(fetch).toHaveBeenCalledTimes(40);
  expect(readWatchlist().map(item => item.guid)).toEqual(['0', 'new', '1']);
  expect(readWatchlist()[0].slug).toBe('changed');
  expect(readWatchlist()[1].detailsChecked).toBeUndefined();
});

test('details backfill skips malformed saved entries and preserves valid progress', async () => {
  const old = talk({ slug: undefined });
  const entry = { event: old, positionSeconds: 100, durationSeconds: 600, updatedAt: 1 };
  localStorage.setItem('continue_watching', JSON.stringify({ version: 1, items: [null, { event: { guid: 'broken' } }, entry] }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ slug: 'found' })));
  await expect(backfillTalkDetails()).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(readPlaybackHistory()).toMatchObject([{ event: { guid: 'talk', slug: 'found' }, positionSeconds: 100 }]);
});

test('report combines playback, watchlist, and progress using stable links and rounded numbers', () => {
  setNowPlayingReader(null);
  expect(buildReport()).toMatchObject({ v: 1, state: 'idle', now: null, watchlist: [], progress: [] });
  expect(talkLink(null)).toBeNull(); expect(talkLink(talk({ slug: undefined }))).toBeNull();
  writeWatchlist([talk(), talk({ guid: 'other', slug: undefined })]);
  replacePlaybackHistory([{ event: talk(), positionSeconds: 100.2, durationSeconds: 600 }]);
  for (const playing of [true, false]) {
    setNowPlayingReader(() => ({ event: talk(), playing, position: 50.6, duration: 600 }));
    expect(buildReport()).toMatchObject({ state: playing ? 'playing' : 'paused', now: { position: 51, duration: 600 }, watchlist: [{ position: 100 }, { position: 0, link: null }], progress: [{ percent: 17, position: 100 }] });
  }
  setNowPlayingReader(() => ({ event: talk(), playing: true, position: 0, duration: 0 }));
  expect(buildReport().now).toMatchObject({ position: 0, duration: 0 });
  setNowPlayingReader(null);
});
