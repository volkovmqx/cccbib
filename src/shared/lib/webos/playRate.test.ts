import { afterEach, expect, test, vi } from 'vitest';
import { applyPlayRate } from './playRate';
import { media } from '../../../../tests/fixtures';

afterEach(() => { vi.unstubAllGlobals(); });

test('outside webOS the rate goes straight to the video element', async () => {
  const video = document.createElement('video');
  expect(await applyPlayRate(video, 1.5)).toBe('ok');
  expect(video.playbackRate).toBe(1.5);
  expect(video.defaultPlaybackRate).toBe(1.5);
});

test('on webOS the media service sets the rate with sound and leaves the element alone', async () => {
  const calls: unknown[][] = [];
  vi.stubGlobal('PalmServiceBridge', class {
    onservicecallback = (_message: string) => {};
    call(uri: string, params: string) { calls.push([uri, JSON.parse(params)]); this.onservicecallback('{"returnValue":true}'); }
    cancel() {}
  });
  const video = media(document.createElement('video'), { mediaId: 'pipe1' });
  expect(await applyPlayRate(video, 1.25)).toBe('ok');
  expect(calls).toEqual([['luna://com.webos.media/setPlayRate', { mediaId: 'pipe1', playRate: 1.25, audioOutput: true }]]);
  expect(video.playbackRate).toBe(1);
});

test('on webOS the rate waits for the pipeline id and reports a refused call', async () => {
  let reply = '{"returnValue":false,"errorCode":-1}';
  vi.stubGlobal('PalmServiceBridge', class {
    onservicecallback = (_message: string) => {};
    call() { this.onservicecallback(reply); }
    cancel() {}
  });
  expect(await applyPlayRate(media(document.createElement('video')), 2)).toBe('pending');
  const video = media(document.createElement('video'), { mediaId: 'pipe1' });
  expect(await applyPlayRate(video, 2)).toBe('failed');
  reply = 'bad';
  expect(await applyPlayRate(video, 2)).toBe('failed');
});
