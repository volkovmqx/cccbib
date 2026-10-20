import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import { applyListCommand } from './remoteLists';
import { setNowPlayingReader } from '@/widgets/player/model/nowPlaying';
import { readWatchlist, addToWatchlistStore } from '@/features/watchlist';
import { readPlaybackHistory, savePlaybackHistoryItem } from '@/features/playback-history';

const talk = { guid: 'talk', title: 'Talk', duration: 600, persons: [], images: {}, videos: [] };
const link = 'https://media.ccc.de/v/talk';
const linkOf = (slug: string) => `https://media.ccc.de/v/${slug}`;

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify({ ...talk, guid: url.split('/').pop(), length: talk.duration }), { status: url.endsWith('/missing') ? 404 : 200 }));
  setNowPlayingReader(null);
});

test('progress preserves the watchlist near the end of a talk', async () => {
  addToWatchlistStore(talk);
  const watchlist = readWatchlist();
  await applyListCommand({ cmd: 'progress', link, position: 400 });
  assert.deepEqual(readWatchlist(), watchlist);
  assert.equal(readPlaybackHistory()[0].positionSeconds, 400);
});

test('add with progress keeps the added talk on the watchlist', async () => {
  await applyListCommand({ cmd: 'add', link, position: 400 });
  assert.equal(readWatchlist()[0]?.guid, talk.guid);
});

test('progress seeks a talk opened by any player', async () => {
  setNowPlayingReader(() => ({ event: talk, playing: true, position: 0, duration: 600 }));
  let position;
  await applyListCommand({ cmd: 'progress', link, position: 400 }, (seconds) => { position = seconds; });
  assert.equal(position, 400);
  assert.deepEqual(readPlaybackHistory(), []);
});

test('progress saves another talk without seeking the current player', async () => {
  setNowPlayingReader(() => ({ event: { ...talk, guid: 'other' }, playing: true, position: 0, duration: 600 }));
  await applyListCommand({ cmd: 'progress', link, position: 100 }, () => assert.fail('Unexpected seek'));
  assert.equal(readPlaybackHistory()[0].positionSeconds, 100);
});

test('progress-set preserves history when any entry is invalid or cannot load', async () => {
  savePlaybackHistoryItem({ event: talk, positionSeconds: 120, durationSeconds: 600 });
  const history = localStorage.getItem('continue_watching');
  for (const invalid of [null, {}, false, 123, { link: 123 }, { link: 'https://example.com/v/talk' }, { link: 'https://media.ccc.de/v/missing' }]) {
    await applyListCommand({ cmd: 'progress-set', items: [{ link, position: 100 }, invalid] });
    assert.equal(localStorage.getItem('continue_watching'), history, JSON.stringify(invalid));
  }
});

test('progress-set replaces history when every entry is valid', async () => {
  savePlaybackHistoryItem({ event: { ...talk, guid: 'old' }, positionSeconds: 120, durationSeconds: 600 });
  await applyListCommand({ cmd: 'progress-set', items: [{ link, position: 100 }] });
  assert.deepEqual(readPlaybackHistory().map((item) => [item.event.guid, item.positionSeconds]), [['talk', 100]]);
});

test('progress-set also validates entries from links and link', async () => {
  savePlaybackHistoryItem({ event: talk, positionSeconds: 120, durationSeconds: 600 });
  const history = localStorage.getItem('continue_watching');
  for (const input of [{ links: [null] }, { link: 123 }]) {
    await applyListCommand({ cmd: 'progress-set', items: [{ link, position: 100 }], ...input });
    assert.equal(localStorage.getItem('continue_watching'), history);
  }
});

test('incremental commands skip invalid entries and keep valid entries', async () => {
  await applyListCommand({ cmd: 'add', items: [null, { link, position: '100' }] });
  assert.equal(readWatchlist()[0].guid, talk.guid);
  assert.equal(readPlaybackHistory()[0].positionSeconds, 100);
});

test('readWatchlist rejects stored values that are not arrays', () => {
  for (const value of ['null', '{}', '123', '"talk"']) {
    localStorage.setItem('watchlist', value);
    assert.deepEqual(readWatchlist(), []);
  }
});

test('list commands report duplicate, removed, and cleared entries', async () => {
  assert.equal((await applyListCommand({ cmd: 'add', link })).kind, 'added');
  assert.equal((await applyListCommand({ cmd: 'add', link })).kind, 'duplicate');
  assert.equal((await applyListCommand({ cmd: 'remove', link })).kind, 'removed');
  assert.equal((await applyListCommand({ cmd: 'progress', link, position: 0 })).kind, 'cleared');
  assert.equal((await applyListCommand({ cmd: 'progress-clear', link })).kind, 'cleared');
  assert.equal((await applyListCommand({ cmd: 'add', items: [] })).kind, 'none');
});

test('batch commands preserve valid entries and report their count', async () => {
  const links = [link, 'media.ccc.de/v/second', 'media.ccc.de/v/third', 'media.ccc.de/v/fourth'];
  for (const cmd of ['add', 'remove', 'progress', 'progress-clear'] as const) {
    const result = await applyListCommand({ cmd, links, percent: 50 });
    assert.equal(result.count, 4);
  }
  const result = await applyListCommand({ cmd: 'progress-set', items: [{ link, position: 0 }, { link: links[1] }, { link: links[2], percent: 40 }] });
  assert.equal(result.kind, 'progressList');
  assert.equal(readPlaybackHistory()[0].event.guid, 'third');
});

test('command item numbers are normalized, clamped, and bounded to fifty entries', async () => {
  const { commandItems } = await import('@/features/remote-control');
  const { progressSeconds } = await import('./remoteProgress');
  assert.equal(commandItems({ cmd: 'add', links: Array(60).fill(link) }).length, 50);
  assert.deepEqual(commandItems({ cmd: 'progress', items: [link, { link, position: null, percent: '' }, { link, position: 'bad' }, { link, percent: '20' }] }).map(item => item.percent), [undefined, undefined, undefined, 20]);
  const full = { ...talk, persons: [], images: {}, videos: [] };
  assert.equal(progressSeconds(full, { percent: 50 }), 300);
  assert.equal(progressSeconds(full, { position: -5 }), 0);
  assert.equal(progressSeconds(full, { position: 900 }), 600);
  assert.equal(progressSeconds({ ...full, duration: 0 }, { percent: 50 }), null);
  assert.equal(progressSeconds(full, {}), null);
});

test('command items are read from items, then links, then link', async () => {
  const { commandItems } = await import('@/features/remote-control');
  const items = commandItems({ cmd: 'add', link: linkOf('a'), links: [linkOf('b')], items: [{ link: linkOf('c'), percent: '50' }] });
  assert.deepEqual(items.map(item => [item.link, item.percent]), [[linkOf('c'), 50], [linkOf('b'), undefined], [linkOf('a'), undefined]]);
});

test('add leaves progress alone, remove keeps progress, and progress-clear keeps the watchlist', async () => {
  await applyListCommand({ cmd: 'add', link: linkOf('plain') });
  assert.deepEqual(readWatchlist().map(item => item.guid), ['plain']);
  assert.deepEqual(readPlaybackHistory(), []);

  await applyListCommand({ cmd: 'add', link: linkOf('both'), position: 100 });
  assert.deepEqual(readPlaybackHistory().map(item => item.event.guid), ['both']);

  await applyListCommand({ cmd: 'remove', link: linkOf('both') });
  assert.deepEqual(readWatchlist().map(item => item.guid), ['plain']);
  assert.deepEqual(readPlaybackHistory().map(item => item.event.guid), ['both']);

  await applyListCommand({ cmd: 'add', link: linkOf('both') });
  await applyListCommand({ cmd: 'progress-clear', link: linkOf('both') });
  assert.deepEqual(readWatchlist().map(item => item.guid), ['plain', 'both']);
  assert.deepEqual(readPlaybackHistory(), []);
});

test('progress under 10 seconds clears the progress and percent becomes seconds', async () => {
  await applyListCommand({ cmd: 'progress', link, percent: 50 });
  assert.equal(readPlaybackHistory()[0].positionSeconds, 300);
  await applyListCommand({ cmd: 'progress', link, position: 5 });
  assert.deepEqual(readPlaybackHistory(), []);
});

test('the in progress list holds 20 talks, newest first', async () => {
  const items = Array.from({ length: 25 }, (_, index) => ({ link: linkOf(`m${index}`), position: 100 }));
  await applyListCommand({ cmd: 'progress-set', items });
  assert.deepEqual(readPlaybackHistory().map(item => item.event.guid), items.slice(0, 20).map(item => item.link.split('/').pop()));
  await applyListCommand({ cmd: 'add', link: linkOf('late'), position: 100 });
  const history = readPlaybackHistory();
  assert.equal(history.length, 20);
  assert.equal(history[0].event.guid, 'late');
});

test('progress-set skips talks under 10 seconds and finished talks', async () => {
  const items = [{ link: linkOf('short'), position: 5 }, { link: linkOf('ok'), position: 300 }, { link: linkOf('done'), position: 590 }];
  await applyListCommand({ cmd: 'progress-set', items });
  assert.deepEqual(readPlaybackHistory().map(item => [item.event.guid, item.positionSeconds]), [['ok', 300]]);
});
