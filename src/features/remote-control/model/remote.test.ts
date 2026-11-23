import { beforeEach, expect, test, vi } from 'vitest';

let remote: typeof import('./remote');
let settings: typeof import('@/shared/config/settings');
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  remote = await import('./remote');
  settings = await import('@/shared/config/settings');
  settings.setSetting('remoteControl', 'on');
});

test('commands validate input and infer play only from a link', () => {
  for (const raw of [null, undefined, 1, false, '{}', '{', { cmd: 'unknown' }, []]) expect(remote.parseCommand(raw)).toBeNull();
  expect(remote.parseCommand('{"cmd":"pause"}')).toEqual({ cmd: 'pause' });
  expect(remote.parseCommand({ link: 'media.ccc.de/v/talk' })).toMatchObject({ cmd: 'play' });
  expect(remote.parseCommand({ cmd: 'progress', position: 20 })).toMatchObject({ cmd: 'progress' });
});

test('app backlog expires and subscription cleanup does not remove a newer handler', () => {
  remote.dispatchCommand({ cmd: 'play' });
  vi.advanceTimersByTime(20000);
  remote.dispatchCommand({ cmd: 'add' });
  const first = vi.fn(); const second = vi.fn();
  const stopFirst = remote.onAppCommand(first);
  expect(first).toHaveBeenCalledExactlyOnceWith({ cmd: 'add' });
  const stopSecond = remote.onAppCommand(second);
  stopFirst();
  remote.dispatchCommand({ cmd: 'remove' });
  expect(second).toHaveBeenCalledExactlyOnceWith({ cmd: 'remove' });
  stopSecond();
});

test('player commands reach only the active handler and queued commands reach the next player', () => {
  remote.dispatchCommand({ cmd: 'pause' });
  remote.queuePlayerCommand({ cmd: 'seek', to: 10 });
  vi.advanceTimersByTime(20000);
  remote.queuePlayerCommand({ cmd: 'aspect', value: 'zoom' });
  const first = vi.fn(); const second = vi.fn();
  const stopFirst = remote.onPlayerCommand(first);
  expect(first).toHaveBeenCalledExactlyOnceWith({ cmd: 'aspect', value: 'zoom' });
  const stopSecond = remote.onPlayerCommand(second);
  stopFirst();
  remote.dispatchCommand({ cmd: 'resume' });
  expect(second).toHaveBeenCalledExactlyOnceWith({ cmd: 'resume' });
  stopSecond();
});

test('launch parameters suppress startup duplicates and remote control can be disabled', () => {
  const handler = vi.fn();
  remote.onAppCommand(handler);
  vi.stubGlobal('webOSSystem', { launchParams: '{"cmd":"play","link":"media.ccc.de/v/talk"}' });
  const stop = remote.initRemote();
  const launch = (detail: unknown) => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail }));
  launch({ cmd: 'play', link: 'media.ccc.de/v/talk' });
  expect(handler).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(3000);
  launch({ cmd: 'play', link: 'media.ccc.de/v/talk' });
  expect(handler).toHaveBeenCalledTimes(2);
  launch('bad');
  settings.setSetting('remoteControl', 'off');
  launch({ cmd: 'play' });
  expect(handler).toHaveBeenCalledTimes(2);
  stop();
});

test('PalmSystem launch and launch events use the same handler', () => {
  const handler = vi.fn();
  remote.onAppCommand(handler);
  vi.stubGlobal('PalmSystem', { launchParams: '{"cmd":"add"}' });
  const stop = remote.initRemote();
  document.dispatchEvent(new CustomEvent('webOSLaunch', { detail: { cmd: 'remove' } }));
  expect(handler.mock.calls.map(call => call[0].cmd)).toEqual(['add', 'remove']);
  stop();
  delete window.PalmSystem;
  remote.initRemote()();
});

test('the mqtt command is an app command that reaches the app from the launch parameters', () => {
  const mqtt = { cmd: 'mqtt', url: 'ws://broker:9001', username: 'user', password: 'secret' };
  expect(remote.parseCommand(mqtt)).toEqual(mqtt);
  expect(remote.parseCommand('{"cmd":"mqtt"}')).toEqual({ cmd: 'mqtt' });
  const app = vi.fn();
  remote.onAppCommand(app);
  vi.stubGlobal('PalmSystem', { launchParams: JSON.stringify(mqtt) });
  remote.initRemote()();
  expect(app).toHaveBeenCalledExactlyOnceWith(mqtt);
  delete window.PalmSystem;
});

test('the password of an mqtt command is not kept in the key that ignores a duplicate start', () => {
  const app = vi.fn();
  remote.onAppCommand(app);
  const stringify = vi.spyOn(JSON, 'stringify');
  const launchParams = JSON.stringify({ cmd: 'mqtt', url: 'ws://broker:9001', username: 'user', password: 'hunter2' });
  vi.stubGlobal('PalmSystem', { launchParams });
  const stop = remote.initRemote();
  document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail: launchParams }));
  stop();
  expect(app).toHaveBeenCalledTimes(1);
  expect(stringify.mock.results.map((result) => String(result.value)).filter((text) => text.includes('hunter2'))).toEqual([launchParams]);
  stringify.mockRestore();
  delete window.PalmSystem;
});
