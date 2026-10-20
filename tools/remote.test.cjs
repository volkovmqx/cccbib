const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { mockBrowser } = require('./test-setup.cjs');

const { applyListCommand } = require('../src/helpers/remoteLists.js');
const { setNowPlayingReader } = require('../src/helpers/nowPlaying.js');
const { readWatchlist, addToWatchlistStore } = require('../src/helpers/watchlist.js');
const { readPlaybackHistory, savePlaybackHistoryItem } = require('../src/helpers/playbackHistory.js');

const talk = { guid: 'talk', title: 'Talk', duration: 600 };
const link = 'https://media.ccc.de/v/talk';

beforeEach(() => {
  mockBrowser();
  global.fetch = async (url) => ({
    ok: !url.endsWith('/missing'),
    status: url.endsWith('/missing') ? 404 : 200,
    json: async () => ({ ...talk, guid: url.split('/').pop(), length: talk.duration }),
  });
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
  setNowPlayingReader(() => ({ event: talk }));
  let position;
  await applyListCommand({ cmd: 'progress', link, position: 400 }, (seconds) => { position = seconds; });
  assert.equal(position, 400);
  assert.deepEqual(readPlaybackHistory(), []);
});

test('progress saves another talk without seeking the current player', async () => {
  setNowPlayingReader(() => ({ event: { guid: 'other' } }));
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
