const assert = require('node:assert/strict');
const { beforeEach, test, mock } = require('node:test');
const { mockBrowser } = require('./test-setup.cjs');

const { talkReference, fetchTalk, commandItems } = require('../src/helpers/remoteTalk.js');
const { parseCommand, initRemote, onAppCommand, onPlayerCommand, queuePlayerCommand, dispatchCommand } = require('../src/remote.js');
const { getSetting, setSetting } = require('../src/settings.js');
const { applyListCommand } = require('../src/helpers/remoteLists.js');
const { readWatchlist, addToWatchlistStore } = require('../src/helpers/watchlist.js');
const { readPlaybackHistory, savePlaybackHistoryItem } = require('../src/helpers/playbackHistory.js');
const { setNowPlayingReader } = require('../src/helpers/nowPlaying.js');
const { buildReport } = require('../src/helpers/report.js');
const { computeOutputWindow } = require('../src/helpers/videoWindow.js');
const { getVideo, getPreviewVideo, isOddAspect } = require('../src/helpers/helpers.js');

const requested = [];
const linkOf = (slug) => `https://media.ccc.de/v/${slug}`;

beforeEach(() => {
  mockBrowser();
  requested.length = 0;
  global.fetch = async (url) => {
    requested.push(url);
    return { ok: true, status: 200, json: async () => ({ guid: url.split('/').pop(), slug: url.split('/').pop(), title: 'Talk', length: 600 }) };
  };
  setNowPlayingReader(null);
});

// Settings are cached after the first read, so this test has to stay first
test('previewVideo saved as off before the Still option reads as still', () => {
  localStorage.setItem('previewVideo', '"off"');
  assert.equal(getSetting('previewVideo'), 'still');
});

test('only media.ccc.de/v/ links are accepted', async () => {
  for (const link of [linkOf('talk'), 'http://media.ccc.de/v/talk', 'media.ccc.de/v/talk', 'https://MEDIA.ccc.de/v/talk?foo=1#t=5']) {
    assert.equal(talkReference(link), 'talk', link);
  }
  const rejected = [
    'https://evil.example/v/talk', 'https://media.ccc.de.evil.example/v/talk', 'https://media.ccc.de@evil.example/v/talk',
    'https://api.media.ccc.de/public/events/talk', 'https://media.ccc.de/public/events/talk', 'talk',
    '419d4f7e-7506-4d46-8700-e47e164a8e32', 'javascript:alert(1)', 'https://media.ccc.de/v/../../etc', 'file:///etc/passwd', null, 123,
  ];
  for (const link of rejected) {
    assert.equal(talkReference(link), null, String(link));
    await assert.rejects(fetchTalk(link), undefined, String(link));
  }
  assert.deepEqual(requested, []);
});

test('recording and subtitle urls outside https media.ccc.de are dropped', async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      guid: 'g',
      slug: 'talk',
      title: 'Talk',
      length: 60,
      recordings: [
        { recording_url: 'https://cdn.media.ccc.de/a.webm', mime_type: 'video/webm' },
        { recording_url: 'https://evil.example/b.webm', mime_type: 'video/webm' },
        { recording_url: 'http://cdn.media.ccc.de/c.webm', mime_type: 'video/webm' },
        { recording_url: 'https://media.ccc.de.evil.example/d.webm', mime_type: 'video/webm' },
        { recording_url: 'https://evilmedia.ccc.de/e.webm', mime_type: 'video/webm' },
        { recording_url: 'https://static.media.ccc.de/x.vtt', mime_type: 'text/vtt' },
        { recording_url: 'https://evil.example/x.vtt', mime_type: 'text/vtt' },
      ],
    }),
  });
  const talk = await fetchTalk(linkOf('talk'));
  assert.deepEqual(talk.videos.map((video) => video.url), ['https://cdn.media.ccc.de/a.webm']);
  assert.deepEqual(talk.subtitles.map((subtitle) => subtitle.url), ['https://static.media.ccc.de/x.vtt']);
});

test('commands are parsed from objects and JSON strings', () => {
  for (const raw of ['{bad', 'null', null, 5, { cmd: 'rm' }, {}]) assert.equal(parseCommand(raw), null, String(raw));
  assert.deepEqual(parseCommand('{"cmd":"pause"}'), { cmd: 'pause' });
  assert.equal(parseCommand({ link: linkOf('talk') }).cmd, 'play');
});

test('a list command takes at most 50 entries from link, links and items', () => {
  const links = Array.from({ length: 60 }, (_, i) => linkOf(`t${i}`));
  assert.equal(commandItems({ links }).length, 50);
  assert.deepEqual(commandItems({ link: linkOf('a'), links: [linkOf('b')], items: [{ link: linkOf('c'), percent: '50' }] }).map((i) => [i.link, i.percent]),
    [[linkOf('c'), 50], [linkOf('b'), undefined], [linkOf('a'), undefined]]);
});

test('app commands wait for the app and expire, player commands are never kept', () => {
  mock.timers.enable({ apis: ['Date'], now: 0 });
  try {
    dispatchCommand({ cmd: 'add', link: linkOf('late') });
    mock.timers.tick(20001);
    const expired = [];
    onAppCommand((command) => expired.push(command.cmd))();
    assert.deepEqual(expired, []);

    dispatchCommand({ cmd: 'add', link: linkOf('fresh') });
    const app = [];
    const stopApp = onAppCommand((command) => app.push(command.cmd));
    assert.deepEqual(app, ['add']);

    dispatchCommand({ cmd: 'pause' });
    queuePlayerCommand({ cmd: 'aspect', value: 'zoom' });
    const player = [];
    const stopPlayer = onPlayerCommand((command) => player.push(command.cmd));
    assert.deepEqual(player, ['aspect']);
    dispatchCommand({ cmd: 'pause' });
    assert.deepEqual(player, ['aspect', 'pause']);
    stopPlayer();
    dispatchCommand({ cmd: 'toggle' });
    assert.deepEqual(player, ['aspect', 'pause']);
    stopApp();
  } finally {
    mock.timers.reset();
  }
});

test('launch parameters follow the Remote control setting and a duplicate relaunch is dropped', () => {
  mock.timers.enable({ apis: ['Date'], now: 1000 });
  const received = [];
  const stop = onPlayerCommand((command) => received.push(command.cmd));
  global.document = new EventTarget();
  const relaunch = (detail) => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail }));
  try {
    setSetting('remoteControl', 'on');
    global.window = { webOSSystem: { launchParams: JSON.stringify({ cmd: 'mute' }) } };
    initRemote();
    assert.deepEqual(received, ['mute']);
    relaunch({ cmd: 'mute' });
    assert.deepEqual(received, ['mute']);
    relaunch(JSON.stringify({ cmd: 'pause' }));
    assert.deepEqual(received, ['mute', 'pause']);
    mock.timers.tick(3001);
    relaunch({ cmd: 'mute' });
    assert.deepEqual(received, ['mute', 'pause', 'mute']);
    setSetting('remoteControl', 'off');
    relaunch({ cmd: 'resume' });
    assert.deepEqual(received, ['mute', 'pause', 'mute']);
  } finally {
    stop();
    mock.timers.reset();
  }
});

test('add without progress leaves the in progress list alone, remove keeps progress, progress-clear keeps the watchlist', async () => {
  await applyListCommand({ cmd: 'add', link: linkOf('plain') });
  assert.deepEqual(readWatchlist().map((i) => i.guid), ['plain']);
  assert.deepEqual(readPlaybackHistory(), []);

  await applyListCommand({ cmd: 'add', link: linkOf('both'), position: 100 });
  assert.deepEqual(readPlaybackHistory().map((i) => i.event.guid), ['both']);

  await applyListCommand({ cmd: 'remove', link: linkOf('both') });
  assert.deepEqual(readWatchlist().map((i) => i.guid), ['plain']);
  assert.deepEqual(readPlaybackHistory().map((i) => i.event.guid), ['both']);

  await applyListCommand({ cmd: 'add', link: linkOf('both') });
  await applyListCommand({ cmd: 'progress-clear', link: linkOf('both') });
  assert.deepEqual(readWatchlist().map((i) => i.guid), ['plain', 'both']);
  assert.deepEqual(readPlaybackHistory(), []);
});

test('progress under 10 seconds clears the progress and percent is turned into seconds', async () => {
  await applyListCommand({ cmd: 'progress', link: linkOf('talk'), percent: 50 });
  assert.equal(readPlaybackHistory()[0].positionSeconds, 300);
  await applyListCommand({ cmd: 'progress', link: linkOf('talk'), position: 5 });
  assert.deepEqual(readPlaybackHistory(), []);
});

test('the in progress list holds 20 talks, newest first', async () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ link: linkOf(`m${i}`), position: 100 }));
  await applyListCommand({ cmd: 'progress-set', items });
  assert.deepEqual(readPlaybackHistory().map((i) => i.event.guid), items.slice(0, 20).map((i) => i.link.split('/').pop()));

  await applyListCommand({ cmd: 'add', link: linkOf('late'), position: 100 });
  const history = readPlaybackHistory();
  assert.equal(history.length, 20);
  assert.equal(history[0].event.guid, 'late');
});

test('progress-set skips talks under 10 seconds and finished talks', async () => {
  await applyListCommand({ cmd: 'progress-set', items: [{ link: linkOf('short'), position: 5 }, { link: linkOf('ok'), position: 300 }, { link: linkOf('done'), position: 590 }] });
  assert.deepEqual(readPlaybackHistory().map((i) => [i.event.guid, i.positionSeconds]), [['ok', 300]]);
});

test('the report shows state, links and positions', () => {
  const talk = { guid: 'g1', slug: 's1', title: 'One', duration: 600 };
  addToWatchlistStore(talk);
  savePlaybackHistoryItem({ event: talk, positionSeconds: 120.4, durationSeconds: 600 });
  let report = buildReport();
  assert.equal(report.state, 'idle');
  assert.equal(report.now, null);
  assert.deepEqual(report.watchlist.map((i) => [i.link, i.position]), [[linkOf('s1'), 120]]);
  assert.equal(report.progress[0].percent, 20);

  setNowPlayingReader(() => ({ event: talk, playing: true, position: 30.6, duration: 600 }));
  report = buildReport();
  assert.equal(report.state, 'playing');
  assert.deepEqual([report.now.link, report.now.position], [linkOf('s1'), 31]);
  setNowPlayingReader(() => ({ event: talk, playing: false, position: 5, duration: 600 }));
  assert.equal(buildReport().state, 'paused');
});

test('zoom, stretch and auto place a 4:3 picture on a 16:9 screen', () => {
  const screen = { x: 0, y: 0, width: 1920, height: 1080 };
  assert.deepEqual(computeOutputWindow('zoom', 640, 480, 1920, 1080), {
    original: { x: 0, y: 0, width: 640, height: 480 },
    source: { x: 0, y: 60, width: 640, height: 360 },
    output: screen,
  });
  const stretched = { x: 0, y: 0, width: 640, height: 360 };
  assert.deepEqual(computeOutputWindow('stretch', 640, 480, 1920, 1080), { original: stretched, source: stretched, output: screen });
  const auto = computeOutputWindow('auto', 640, 480, 1920, 1080);
  assert.deepEqual(auto.output, { x: 240, y: 0, width: 1440, height: 1080 });
  assert.deepEqual(auto.source, auto.original);
  assert.deepEqual(computeOutputWindow('zoom', 1920, 804, 1920, 1080).source, { x: 246, y: 0, width: 1429, height: 804 });
});

test('recording choice follows language, format and width', () => {
  const rec = (mimeType, language, width) => ({ url: `${mimeType}-${language}-${width}`, mimeType, language, width, height: Math.round(width * 9 / 16) });
  const videos = [rec('video/mp4', 'deu', 1920), rec('video/webm', 'deu', 480), rec('video/webm', 'deu', 1280), rec('video/webm', 'eng', 1920), rec('video/webm', 'deu-eng', 1920)];
  assert.equal(getVideo(videos, 'deu')[0].url, 'video/webm-deu-1280');
  assert.equal(getVideo(videos, 'eng')[0].url, 'video/webm-eng-1920');
  assert.equal(getVideo(videos, 'fra')[0].url, 'video/webm-eng-1920');
  assert.equal(getVideo(videos, 'auto')[0].width, 1920);
  assert.equal(getPreviewVideo(videos, 'deu').width, 480);
  assert.deepEqual(getVideo([], 'deu'), [null, undefined]);
});

test('only recordings away from 16:9 count as odd', () => {
  assert.equal(isOddAspect([{ url: 'a', mimeType: 'video/webm', language: 'deu', width: 720, height: 576 }], 'deu'), true);
  assert.equal(isOddAspect([{ url: 'a', mimeType: 'video/webm', language: 'deu', width: 1280, height: 720 }], 'deu'), false);
  assert.equal(isOddAspect([{ url: 'a', mimeType: 'video/webm', language: 'deu', width: 1280 }], 'deu'), false);
  assert.equal(isOddAspect(undefined, 'deu'), false);
});
