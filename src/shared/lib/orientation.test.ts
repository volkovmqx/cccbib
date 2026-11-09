import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { lockLandscape } from './orientation';

const flush = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });
const error = (name: string) => Object.assign(new Error(name), { name });

let orientation: { type: string; lock: ReturnType<typeof vi.fn>; unlock: ReturnType<typeof vi.fn> };
let fullscreen: Element | null;
let enter: ReturnType<typeof vi.fn>;
let leave: ReturnType<typeof vi.fn>;

function device(touch = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: touch && query === '(hover: none) and (pointer: coarse)', media: query, addListener() {}, removeListener() {} }));
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch ? 5 : 0, configurable: true });
}

beforeEach(() => {
  orientation = { type: 'portrait-primary', lock: vi.fn().mockResolvedValue(undefined), unlock: vi.fn() };
  Object.defineProperty(screen, 'orientation', { value: orientation, configurable: true });
  fullscreen = null;
  enter = vi.fn(() => { fullscreen = document.documentElement; return Promise.resolve(); });
  leave = vi.fn(() => { fullscreen = null; return Promise.resolve(); });
  Object.defineProperty(document, 'fullscreenElement', { get: () => fullscreen, configurable: true });
  document.documentElement.requestFullscreen = enter as never;
  document.exitFullscreen = leave as never;
  device();
});

afterEach(() => { vi.unstubAllGlobals(); });

test('a phone held upright is turned to landscape and given back when the player is left', async () => {
  const release = lockLandscape();
  await flush();
  expect(orientation.lock).toHaveBeenCalledWith('landscape');
  expect(enter).not.toHaveBeenCalled();
  release();
  expect(orientation.unlock).toHaveBeenCalledTimes(1);
  expect(leave).not.toHaveBeenCalled();
});

test('a device that is already sideways stays in the landscape it has', async () => {
  orientation.type = 'landscape-secondary';
  lockLandscape();
  await flush();
  expect(orientation.lock).toHaveBeenCalledWith('landscape-secondary');
});

test('a browser tab that refuses the lock outside fullscreen gets fullscreen first, and leaves it again at the end', async () => {
  orientation.lock.mockRejectedValueOnce(error('SecurityError'));
  const release = lockLandscape();
  await flush();
  expect(enter).toHaveBeenCalledTimes(1);
  expect(orientation.lock).toHaveBeenCalledTimes(2);
  release();
  expect(orientation.unlock).toHaveBeenCalledTimes(1);
  expect(leave).toHaveBeenCalledTimes(1);
  release();
  expect(leave).toHaveBeenCalledTimes(1);
});

test('fullscreen is left again when the lock still fails inside it or fullscreen is refused', async () => {
  orientation.lock.mockRejectedValue(error('SecurityError'));
  lockLandscape();
  await flush();
  expect(enter).toHaveBeenCalledTimes(1);
  expect(leave).toHaveBeenCalledTimes(1);

  orientation.lock.mockReset().mockRejectedValueOnce(error('SecurityError'));
  enter.mockRejectedValueOnce(error('TypeError'));
  const release = lockLandscape();
  await flush();
  expect(orientation.lock).toHaveBeenCalledTimes(1);
  expect(leave).toHaveBeenCalledTimes(1);
  release();
  expect(leave).toHaveBeenCalledTimes(1);
});

test('other lock errors, a page that is fullscreen already and a missing fullscreen API do nothing more', async () => {
  orientation.lock.mockRejectedValueOnce(error('NotSupportedError'));
  lockLandscape();
  await flush();
  expect(enter).not.toHaveBeenCalled();

  fullscreen = document.documentElement;
  orientation.lock.mockRejectedValueOnce(error('SecurityError'));
  lockLandscape();
  await flush();
  expect(enter).not.toHaveBeenCalled();

  fullscreen = null;
  document.documentElement.requestFullscreen = undefined as never;
  orientation.lock.mockRejectedValueOnce(error('SecurityError'));
  lockLandscape();
  await flush();
  expect(orientation.lock).toHaveBeenCalledTimes(3);
});

test('leaving before the lock or fullscreen has finished leaves nothing behind', async () => {
  orientation.lock.mockRejectedValueOnce(error('SecurityError'));
  lockLandscape()();
  await flush();
  expect(enter).not.toHaveBeenCalled();

  orientation.lock.mockRejectedValueOnce(error('SecurityError'));
  let finish: () => void = () => {};
  enter.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = () => { fullscreen = document.documentElement; resolve(); }; }));
  const release = lockLandscape();
  await flush();
  release();
  finish();
  await flush();
  expect(orientation.lock).toHaveBeenCalledTimes(2);
  expect(leave).toHaveBeenCalledTimes(1);
});

test('nothing happens on a desktop window, on the TV or where the browser cannot lock', async () => {
  const idle = () => { orientation.lock.mockClear(); const release = lockLandscape(); release(); return orientation.lock.mock.calls.length + orientation.unlock.mock.calls.length + enter.mock.calls.length; };
  device(false);
  expect(idle()).toBe(0);
  device(true);
  vi.stubGlobal('PalmServiceBridge', class {});
  expect(idle()).toBe(0);
  vi.unstubAllGlobals();
  device(true);
  vi.stubGlobal('matchMedia', undefined);
  expect(idle()).toBe(0);
  vi.unstubAllGlobals();
  device(true);
  Object.defineProperty(screen, 'orientation', { value: { type: 'portrait-primary', unlock: vi.fn() }, configurable: true });
  expect(idle()).toBe(0);
  Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true });
  expect(idle()).toBe(0);
});

test('unlocking a lock the browser never took does not break leaving the player', () => {
  orientation.unlock.mockImplementation(() => { throw error('InvalidStateError'); });
  const release = lockLandscape();
  expect(() => release()).not.toThrow();
});
