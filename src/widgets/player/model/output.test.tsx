import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { applyOutputWindow, usesOutputWindow } from '@/shared/lib';
import { media } from '../../../../tests/fixtures';
import { useOutputWindow } from './useOutputWindow';

vi.mock('@/shared/lib', async importOriginal => ({ ...await importOriginal<typeof import('@/shared/lib')>(), applyOutputWindow: vi.fn(), usesOutputWindow: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.mocked(usesOutputWindow).mockReturnValue(true); vi.mocked(applyOutputWindow).mockResolvedValue('ok'); });

test('output hook waits for a video, ignores newer browsers, and restores auto mode', async () => {
  const video = media(document.createElement('video'), { mediaId: 'id' });
  const { rerender, unmount } = renderHook(({ video, mode }) => useOutputWindow(video, mode), { initialProps: { video: null as HTMLVideoElement | null, mode: 'auto' } });
  rerender({ video, mode: 'auto' }); expect(applyOutputWindow).not.toHaveBeenCalled();
  vi.mocked(usesOutputWindow).mockReturnValue(false);
  rerender({ video, mode: 'zoom' }); expect(applyOutputWindow).not.toHaveBeenCalled();
  vi.mocked(usesOutputWindow).mockReturnValue(true);
  await act(async () => { rerender({ video, mode: 'stretch' }); });
  expect(applyOutputWindow).toHaveBeenLastCalledWith(video, 'stretch');
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(applyOutputWindow).toHaveBeenCalledTimes(2);
  await act(async () => { video.dispatchEvent(new Event('loadedmetadata')); video.dispatchEvent(new Event('resize')); });
  expect(applyOutputWindow).toHaveBeenCalledTimes(4);
  await act(async () => { rerender({ video, mode: 'auto' }); });
  expect(applyOutputWindow).toHaveBeenLastCalledWith(video, 'auto');
  unmount();
});

test.each([['pending', 40], ['failed', 5], ['wait', 1]] as const)('output hook limits %s retries', async (response, count) => {
  vi.mocked(applyOutputWindow).mockResolvedValue(response);
  renderHook(() => useOutputWindow(media(document.createElement('video')), 'zoom'));
  await act(async () => { await vi.advanceTimersByTimeAsync(25000); });
  expect(applyOutputWindow).toHaveBeenCalledTimes(count);
});

test('output hook ignores a service response after unmount', async () => {
  let resolve!: (value: 'ok') => void;
  vi.mocked(applyOutputWindow).mockImplementation(() => new Promise<'ok'>(next => { resolve = next; }));
  const hook = renderHook(() => useOutputWindow(media(document.createElement('video')), 'zoom'));
  hook.unmount();
  await act(async () => { resolve('ok'); });
  expect(vi.getTimerCount()).toBe(0);
});
