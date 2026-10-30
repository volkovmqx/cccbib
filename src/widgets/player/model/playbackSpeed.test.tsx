import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { applyPlayRate } from '@/shared/lib';
import { media } from '../../../../tests/fixtures';
import { usePlaybackSpeed } from './usePlaybackSpeed';

vi.mock('@/shared/lib', async importOriginal => ({ ...await importOriginal<typeof import('@/shared/lib')>(), applyPlayRate: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(applyPlayRate).mockReset(); vi.mocked(applyPlayRate).mockResolvedValue('ok'); });

const video = () => media(document.createElement('video'), { mediaId: 'id' });

test('normal speed leaves a fresh video alone and a changed speed is applied and taken back', async () => {
  const first = video(); const second = video(); const unsupported = vi.fn();
  const { rerender } = renderHook(({ element, speed }) => usePlaybackSpeed(element, speed, unsupported), { initialProps: { element: null as HTMLVideoElement | null, speed: 1 } });
  await act(async () => { rerender({ element: first, speed: 1 }); });
  expect(applyPlayRate).not.toHaveBeenCalled();
  await act(async () => { rerender({ element: first, speed: 1.5 }); });
  expect(applyPlayRate).toHaveBeenLastCalledWith(first, 1.5);
  await act(async () => { rerender({ element: first, speed: 1 }); });
  expect(applyPlayRate).toHaveBeenLastCalledWith(first, 1);
  expect(applyPlayRate).toHaveBeenCalledTimes(2);
  await act(async () => { rerender({ element: second, speed: 1 }); });
  expect(applyPlayRate).toHaveBeenCalledTimes(2);
  expect(unsupported).not.toHaveBeenCalled();
});

test('the speed is applied again when a new source loads or playback resumes', async () => {
  const element = video();
  renderHook(() => usePlaybackSpeed(element, 2, vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(applyPlayRate).toHaveBeenCalledTimes(1);
  await act(async () => { element.dispatchEvent(new Event('loadedmetadata')); element.dispatchEvent(new Event('playing')); });
  expect(applyPlayRate).toHaveBeenCalledTimes(3);
});

test.each([['pending', 20], ['failed', 4]] as const)('a %s answer is retried %i times, then the speed counts as unsupported', async (answer, count) => {
  vi.mocked(applyPlayRate).mockResolvedValue(answer);
  const unsupported = vi.fn();
  renderHook(() => usePlaybackSpeed(video(), 1.5, unsupported));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(applyPlayRate).toHaveBeenCalledTimes(count);
  expect(unsupported).toHaveBeenCalledTimes(1);
});

test('an answer that arrives after unmount changes nothing', async () => {
  let resolve!: (value: 'failed') => void;
  vi.mocked(applyPlayRate).mockImplementation(() => new Promise<'failed'>(next => { resolve = next; }));
  const unsupported = vi.fn();
  const hook = renderHook(() => usePlaybackSpeed(video(), 1.5, unsupported));
  hook.unmount();
  await act(async () => { resolve('failed'); });
  expect(vi.getTimerCount()).toBe(0);
  expect(unsupported).not.toHaveBeenCalled();
});
