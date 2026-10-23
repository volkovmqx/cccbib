import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StatsContext } from './playbackStats';
import { bufferedRange, collectStats, fileFormat, nextRate } from './playbackStats';
import { usePlaybackStats } from './usePlaybackStats';

const ranges = (...pairs: [number, number][]) => ({ length: pairs.length, start: (index: number) => pairs[index][0], end: (index: number) => pairs[index][1] });
const fakeVideo = (overrides: Record<string, unknown> = {}) => ({
  currentTime: 100, duration: 600, paused: false, ended: false, playbackRate: 1, readyState: 4, networkState: 2, volume: 0.5, muted: false,
  videoWidth: 1920, videoHeight: 1080, buffered: ranges([0, 130]), ...overrides,
}) as unknown as HTMLVideoElement;
const context = (overrides: Partial<StatsContext> = {}): StatsContext => ({
  guid: 'guid-1', recording: { url: 'u', mimeType: 'video/mp4', language: 'deu', width: 1920, height: 1080, size: 100 }, duration: 600,
  sourceUrl: 'https://ffmuc.media.ccc.de/events/x/h264-hd/talk_hd.mp4', sourceIndex: 0, sourceCount: 4, aspect: 'auto', audioLanguage: 'deu',
  subtitleLanguage: 'none', subtitleStatus: 'idle', buffering: false, version: '1.2.3', ...overrides,
});
const rate = (at: number, time: number, start: number, end: number, fill = 0) => ({ at, time, start, end, fill });
const value = (rows: { label: string; value: string }[], label: string) => rows.find(row => row.label === label)!.value;
afterEach(() => { vi.unstubAllGlobals(); });

test('the buffered range is the range that holds the playback position', () => {
  expect(bufferedRange(fakeVideo())).toEqual({ start: 0, end: 130 });
  expect(bufferedRange(fakeVideo({ buffered: ranges([0, 50], [90, 140]) }))).toEqual({ start: 90, end: 140 });
  expect(bufferedRange(fakeVideo({ buffered: ranges([0, 50]) }))).toEqual({ start: 100, end: 100 });
  expect(bufferedRange(fakeVideo({ buffered: ranges() }))).toEqual({ start: 100, end: 100 });
});

test('the bitrate comes from the listed file size and length and is unknown without them', () => {
  const bitrate = (recording: StatsContext['recording'], duration: number) => value(collectStats(fakeVideo(), context({ recording, duration }), null), 'Bitrate');
  expect(bitrate({ url: 'u', mimeType: 'm', language: 'l', size: 100 }, 800)).toBe('about 1.00 Mbit/s');
  for (const size of [undefined, null, 0]) expect(bitrate({ url: 'u', mimeType: 'm', language: 'l', size: size as number }, 800)).toBe('unknown');
  expect(bitrate({ url: 'u', mimeType: 'm', language: 'l', size: 100 }, 0)).toBe('unknown');
  expect(bitrate(null, 800)).toBe('unknown');
});

test('the buffer growth tells how many seconds of video arrive per second and is zero while the buffer is full', () => {
  const first = nextRate(null, 1000, fakeVideo({ currentTime: 100, buffered: ranges([0, 100]) }));
  expect(first).toEqual(rate(1000, 100, 0, 100));
  const growing = nextRate(first, 2000, fakeVideo({ currentTime: 101, buffered: ranges([0, 104]) }));
  expect(growing).toEqual(rate(2000, 101, 0, 104, 4));
  expect(nextRate(growing, 3000, fakeVideo({ currentTime: 102, buffered: ranges([0, 104]) })).fill).toBe(0);
  expect(nextRate(growing, 3000, fakeVideo({ currentTime: 102, buffered: ranges([0, 104.005]) })).fill).toBe(0);
  expect(nextRate(growing, 3000, fakeVideo({ currentTime: 102, buffered: ranges([0, 100]) })).fill).toBe(0);
  expect(nextRate(first, 1000, fakeVideo({ currentTime: 100, buffered: ranges([0, 105]) })).fill).toBe(0);
});

test('a seek is no download: jumping around the video or into another buffered range only starts the measurement again', () => {
  const before = rate(1000, 100, 0, 130);
  const forward = nextRate(before, 2000, fakeVideo({ currentTime: 940, buffered: ranges([0, 969]) }));
  expect(forward).toEqual(rate(2000, 940, 0, 969));
  expect(nextRate(before, 2000, fakeVideo({ currentTime: 20, buffered: ranges([0, 130]) })).fill).toBe(0);
  expect(nextRate(before, 2000, fakeVideo({ currentTime: 500, buffered: ranges([0, 130], [480, 560]) }))).toEqual(rate(2000, 500, 480, 560));
  expect(nextRate(forward, 3000, fakeVideo({ currentTime: 941, buffered: ranges([0, 972]) })).fill).toBe(3);
  expect(nextRate(before, 3000, fakeVideo({ currentTime: 103, buffered: ranges([0, 150]), playbackRate: 2 })).fill).toBe(10);
  expect(nextRate(before, 3000, fakeVideo({ currentTime: 106, buffered: ranges([0, 150]), playbackRate: 2 })).fill).toBe(0);
});

test('the file format is read from the folder or the extension of the address', () => {
  expect(fileFormat('https://x/events/denog7/h264-hd/talk_hd.mp4', 'video/mp4')).toBe('h264-hd / video/mp4');
  expect(fileFormat('https://x/congress/2016/webm-hd/talk.webm?x=1')).toBe('webm-hd');
  expect(fileFormat('https://x/path/talk.mkv')).toBe('mkv');
  expect(fileFormat('https://x/path/talk')).toBe('');
});

test('the stats list the mirror, file, resolution, buffer, and state of the playback', () => {
  vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/68.0.3440.106', connection: { downlink: 9.5, effectiveType: '4g', rtt: 50 } });
  const rows = collectStats(fakeVideo(), context(), rate(1, 100, 0, 130, 3));
  expect(value(rows, 'Video')).toBe('guid-1');
  expect(value(rows, 'Mirror')).toBe('ffmuc.media.ccc.de (37% share)');
  expect(value(rows, 'Source')).toBe('1 of 4');
  expect(value(rows, 'File')).toBe('h264-hd / video/mp4, 100 MB');
  expect(value(rows, 'Bitrate')).toBe('about 1.33 Mbit/s');
  expect(value(rows, 'Resolution')).toBe('1920x1080');
  expect(value(rows, 'Aspect')).toBe('1.78 (auto)');
  expect(value(rows, 'Buffer')).toBe('30.0 s ahead, 1 range');
  expect(value(rows, 'Buffer fill')).toBe('3.0x realtime');
  expect(value(rows, 'Connection')).toBe('about 9.5 Mbit/s, 4g, 50 ms');
  expect(value(rows, 'Position')).toBe('00:01:40 / 00:10:00');
  expect(value(rows, 'State')).toBe('playing, 1x, enough data, network loading');
  expect(value(rows, 'Audio')).toBe('deu, player volume 50%');
  expect(value(rows, 'Engine')).toBe('Chrome 68, app 1.2.3');
  expect(value(rows, 'Frames')).toBe('not reported by this TV');
  expect(value(rows, 'Viewport')).toMatch(/^\d+x\d+ @\d+x$/);
});

test('the stats say what is unknown instead of guessing', () => {
  vi.stubGlobal('navigator', { ...navigator, userAgent: 'Other' });
  const rows = collectStats(
    fakeVideo({ videoWidth: 0, videoHeight: 0, duration: NaN, paused: true, muted: true, readyState: 9, networkState: 9, buffered: ranges([0, 100], [200, 210]), playbackRate: 1.5, getVideoPlaybackQuality: () => ({ totalVideoFrames: 1000, droppedVideoFrames: 12 }) }),
    context({ recording: { url: 'u', mimeType: 'video/mp4', language: 'deu', width: 720, height: 576 }, sourceUrl: 'https://cdn.media.ccc.de/x.mp4', buffering: true, sourceIndex: 3 }), null);
  expect(value(rows, 'Mirror')).toBe('cdn.media.ccc.de (direct)');
  expect(value(rows, 'Bitrate')).toBe('unknown');
  expect(value(rows, 'Resolution')).toBe('waiting for the video (listed 720x576)');
  expect(value(rows, 'Aspect')).toBe('- (auto)');
  expect(value(rows, 'Frames')).toBe('12 dropped of 1000');
  expect(value(rows, 'Buffer fill')).toBe('buffer full or idle');
  expect(value(rows, 'Connection')).toBe('not reported by this TV');
  expect(value(rows, 'Position')).toBe('00:01:40 / 00:10:00');
  expect(value(rows, 'State')).toBe('buffering, 1.5x, 9, network 9');
  expect(value(rows, 'Audio')).toContain('(muted)');
  expect(value(rows, 'Engine')).toBe('unknown browser, app 1.2.3');
  expect(value(collectStats(fakeVideo({ ended: true, paused: true, webkitDecodedFrameCount: 10, webkitDroppedFrameCount: 1 }), context(), rate(1, 100, 0, 130, 2)), 'State')).toContain('ended');
  expect(value(collectStats(fakeVideo({ webkitDecodedFrameCount: 10, webkitDroppedFrameCount: 1 }), context({ sourceUrl: 'https://other.example/x.mp4' }), rate(1, 100, 0, 130, 2)), 'Frames')).toBe('1 dropped of 10');
  expect(value(collectStats(fakeVideo(), context({ sourceUrl: 'https://other.example/x.mp4' }), rate(1, 100, 0, 130, 2)), 'Buffer fill')).toBe('2.0x realtime');
  expect(value(collectStats(fakeVideo(), context({ sourceUrl: 'https://other.example/x.mp4', recording: null }), null), 'File')).toBe('mp4');
});

test('the stats are read once a second while the panel is open and cleared when it closes', () => {
  vi.useFakeTimers();
  const video = fakeVideo();
  const { result, rerender, unmount } = renderHook(({ active, video: element }) => usePlaybackStats({ video: element, context: context(), active }), { initialProps: { active: false, video: video as HTMLVideoElement | null } });
  expect(result.current).toEqual([]);
  rerender({ active: true, video });
  expect(value(result.current, 'Buffer')).toBe('30.0 s ahead, 1 range');
  (video as unknown as { buffered: unknown }).buffered = ranges([0, 136]);
  act(() => { vi.advanceTimersByTime(1000); });
  expect(value(result.current, 'Buffer')).toBe('36.0 s ahead, 1 range');
  expect(value(result.current, 'Buffer fill')).toBe('6.0x realtime');
  rerender({ active: false, video });
  expect(result.current).toEqual([]);
  rerender({ active: true, video: null });
  expect(result.current).toEqual([]);
  unmount();
});

test('the stats describe a video that has not started: no size, no listed size, buffering and a direct CDN source', () => {
  const rows = collectStats(
    fakeVideo({ videoWidth: 0, videoHeight: 0, buffered: ranges([0, 10]), playbackRate: 1.5, readyState: 9, networkState: 9, muted: true }),
    context({ recording: { url: 'u', mimeType: 'video/webm', language: 'deu' }, buffering: true, sourceUrl: 'https://cdn.media.ccc.de/x/talk.webm', audioLanguage: '', subtitleLanguage: 'eng' }),
    rate(1, 100, 0, 10),
  );
  expect(value(rows, 'Resolution')).toBe('waiting for the video');
  expect(value(rows, 'Aspect')).toBe('- (auto)');
  expect(value(rows, 'State')).toContain('buffering, 1.5x, 9, network 9');
  expect(value(rows, 'Mirror')).toBe('cdn.media.ccc.de (direct)');
  expect(value(rows, 'Buffer fill')).toBe('buffer full or idle');
  expect(value(rows, 'Buffer')).toContain('1 range');
  expect(value(rows, 'Audio')).toContain('unknown, player volume 50% (muted)');
  expect(value(rows, 'Subtitles')).toBe('eng (not showing)');
  expect(value(collectStats(fakeVideo(), context(), null), 'Buffer fill')).toBe('buffer full or idle');
});

test('the stats show the connection when the browser reports one and name an unknown browser', () => {
  Object.defineProperty(navigator, 'connection', { value: { downlink: 5, effectiveType: '4g', rtt: 50 }, configurable: true });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 plain');
  const rows = collectStats(fakeVideo({ paused: true, buffered: ranges([0, 130], [200, 300]) }), context({ recording: { url: 'u', mimeType: 'video/webm', language: 'deu', width: 640, height: 360 } }), rate(1, 100, 0, 130, 1));
  expect(value(rows, 'Connection')).toBe('about 5 Mbit/s, 4g, 50 ms');
  expect(value(rows, 'Engine')).toContain('unknown browser');
  expect(value(rows, 'Resolution')).toBe('1920x1080 (listed 640x360)');
  expect(value(rows, 'State')).toContain('paused');
  expect(value(rows, 'Buffer')).toContain('2 ranges');
  Object.defineProperty(navigator, 'connection', { value: { downlink: 5 }, configurable: true });
  expect(value(collectStats(fakeVideo(), context(), null), 'Connection')).toBe('about 5 Mbit/s');
  Object.defineProperty(navigator, 'connection', { value: { downlink: 9.7, effectiveType: '4g', rtt: 0 }, configurable: true });
  expect(value(collectStats(fakeVideo(), context(), null), 'Connection')).toBe('about 9.7 Mbit/s, 4g');
  Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  expect(value(collectStats(fakeVideo(), context(), null), 'Connection')).toBe('not reported by this TV');
});

test('the mirror is the address the video element really loads, not what the app asked for', () => {
  const rows = collectStats(fakeVideo({ currentSrc: 'https://ftp.fau.de/cdn.media.ccc.de/events/x/h264-hd/talk_hd.mp4' }), context({ sourceUrl: 'https://ffmuc.media.ccc.de/events/x/h264-hd/talk_hd.mp4' }), null);
  expect(value(rows, 'Mirror')).toBe('ftp.fau.de (21% share)');
  expect(value(collectStats(fakeVideo({ currentSrc: '' }), context(), null), 'Mirror')).toBe('ffmuc.media.ccc.de (37% share)');
});

test('the subtitles row tells whether a track is really showing, still loading, off or not available', () => {
  const track = (mode: string, cues: number | null) => ({ mode, cues: cues === null ? null : { length: cues } });
  const row = (video: Record<string, unknown>, overrides: Partial<StatsContext>) => value(collectStats(fakeVideo(video), context(overrides), null), 'Subtitles');
  expect(row({}, {})).toBe('off');
  expect(row({ textTracks: [track('showing', 842)] }, { subtitleLanguage: 'eng', subtitleStatus: 'ready' })).toBe('eng, 842 cues');
  expect(row({ textTracks: [track('disabled', 3), track('showing', null)] }, { subtitleLanguage: 'eng', subtitleStatus: 'ready' })).toBe('eng, 0 cues');
  expect(row({ textTracks: [track('disabled', 3)] }, { subtitleLanguage: 'eng', subtitleStatus: 'loading' })).toBe('eng (loading)');
  expect(row({}, { subtitleLanguage: 'eng', subtitleStatus: 'error' })).toBe('eng (not available)');
  expect(row({}, { subtitleLanguage: 'eng', subtitleStatus: 'ready' })).toBe('eng (not showing)');
});
