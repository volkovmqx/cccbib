import { expect, test, vi } from 'vitest';
import { applyOutputWindow, computeOutputWindow, usesOutputWindow } from './videoWindow';
import { media } from '../../../tests/fixtures';

test('webOS output windows fit, crop, or stretch on both aspect orientations', () => {
  expect(computeOutputWindow('auto', 640, 480, 1920, 1080).output).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
  expect(computeOutputWindow('zoom', 640, 480, 1920, 1080).source).toEqual({ x: 0, y: 60, width: 640, height: 360 });
  expect(computeOutputWindow('zoom', 1920, 800, 1920, 1080).source).toEqual({ x: 249, y: 0, width: 1422, height: 800 });
  expect(computeOutputWindow('stretch', 640, 480, 1920, 1080).original.height).toBe(360);
});

test('output service applies only to old webOS browsers', () => {
  expect(usesOutputWindow()).toBe(false);
  vi.stubGlobal('PalmServiceBridge', class {});
  for (const [agent, expected] of [['Chrome/68', true], ['Chrome/79', false], ['unknown', false]] as const) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent);
    expect(usesOutputWindow()).toBe(expected);
  }
});

test.each([
  ['{"returnValue":true}', 'ok'], ['{"returnValue":false,"errorCode":53}', 'pending'],
  ['{"returnValue":false,"errorCode":1}', 'failed'], ['bad', 'failed'], ['null', 'failed'],
] as const)('output service handles response %s', async (reply, expected) => {
  const cancel = vi.fn();
  vi.stubGlobal('PalmServiceBridge', class {
    onservicecallback = (_message: string) => {};
    call() { this.onservicecallback(reply); }
    cancel = cancel;
  });
  const video = media(document.createElement('video'), { mediaId: 'id' });
  expect(await applyOutputWindow(video, 'zoom')).toBe(expected);
  expect(cancel).toHaveBeenCalled();
});

test('output service handles missing metadata, registration, timeouts, and bridge failures', async () => {
  vi.useFakeTimers();
  const video = media(document.createElement('video'), { videoWidth: 0 });
  expect(await applyOutputWindow(video, 'auto')).toBe('wait');
  media(video, { videoWidth: 640, videoHeight: 0 });
  expect(await applyOutputWindow(video, 'auto')).toBe('wait');
  media(video);
  expect(await applyOutputWindow(video, 'auto')).toBe('pending');
  video.mediaId = 'id';
  vi.stubGlobal('PalmServiceBridge', class { onservicecallback = (_message: string) => {}; call() {} cancel() { throw Error('closed'); } });
  vi.spyOn(window.screen, 'width', 'get').mockReturnValue(0);
  vi.spyOn(window.screen, 'height', 'get').mockReturnValue(0);
  vi.stubGlobal('innerWidth', 0); vi.stubGlobal('innerHeight', 0);
  const pending = applyOutputWindow(video, 'auto');
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBe('failed');
  vi.stubGlobal('PalmServiceBridge', class { constructor() { throw Error('unavailable'); } });
  expect(await applyOutputWindow(video, 'auto')).toBe('failed');
});
