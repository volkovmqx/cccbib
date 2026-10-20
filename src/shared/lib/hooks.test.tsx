import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { useIdle, useListState, useWindowEvent } from './utils';
import { useListNavigation } from './useListNavigation';
import { useImagePreload, preloadImages } from './useImagePreload';
import { useOnlineStatus } from './useOnlineStatus';
import { scrollIntoView, useScrollIntoView } from './scrollHelpers';

test('window listeners use the latest callback and remove listeners on unmount', () => {
  const first = vi.fn(); const second = vi.fn();
  const { rerender, unmount } = renderHook(({ callback }) => useWindowEvent('resize', callback), { initialProps: { callback: first } });
  act(() => { window.dispatchEvent(new Event('resize')); });
  rerender({ callback: second });
  act(() => { window.dispatchEvent(new Event('resize')); });
  expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
  unmount(); window.dispatchEvent(new Event('resize'));
  expect(second).toHaveBeenCalledTimes(1);
});

test('idle state follows input, focus, visibility, and its timeout', () => {
  vi.useFakeTimers();
  const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const { result, unmount } = renderHook(() => useIdle(100));
  expect(result.current).toBe(false);
  act(() => { vi.advanceTimersByTime(100); });
  expect(result.current).toBe(true);
  for (const name of ['keydown', 'mousemove', 'focus']) {
    act(() => { window.dispatchEvent(new Event(name)); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(result.current).toBe(true);
  }
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current).toBe(false);
  hidden.mockReturnValue(true);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current).toBe(true);
  unmount();
  hasFocus.mockReturnValue(false);
  expect(renderHook(() => useIdle(100)).result.current).toBe(true);
});

test('list state handlers remain stable and prepend and shift values', () => {
  const { result } = renderHook(() => useListState([1]));
  const handlers = result.current[1];
  act(() => { handlers.prepend(2, 3); });
  expect(result.current[0]).toEqual([2, 3, 1]);
  act(() => { handlers.shift(); });
  expect(result.current[0]).toEqual([3, 1]);
  act(() => { handlers.setState([]); });
  expect(result.current[0]).toEqual([]);
  expect(result.current[1]).toBe(handlers);
});

test('list navigation wraps selection, transfers focus, and handles both back keys', () => {
  const onClose = vi.fn(); const onSelect = vi.fn(); const onFocusSidebar = vi.fn();
  const { result, rerender } = renderHook(({ disabled, sidebarFocused, itemCount }) => {
    const [index, setIndex] = useState(0);
    useListNavigation({ itemCount, selectedIndex: index, setSelectedIndex: setIndex, onClose, onSelect, onFocusSidebar, disabled, sidebarFocused });
    return index;
  }, { initialProps: { disabled: false, sidebarFocused: false, itemCount: 3 } });
  const key = (key: string, keyCode = 0) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, cancelable: true })); });
  key('ArrowUp'); expect(result.current).toBe(2);
  key('ArrowDown'); expect(result.current).toBe(0);
  key('Enter'); expect(onSelect).toHaveBeenCalledWith(0);
  key('ArrowLeft'); expect(onFocusSidebar).toHaveBeenCalled();
  key('Escape'); key('Backspace'); key('Unidentified', 461); key('x');
  expect(onClose).toHaveBeenCalledTimes(3);
  for (const props of [{ disabled: true, sidebarFocused: false, itemCount: 3 }, { disabled: false, sidebarFocused: true, itemCount: 3 }, { disabled: false, sidebarFocused: false, itemCount: 0 }]) {
    rerender(props); key('Enter');
  }
  expect(onSelect).toHaveBeenCalledTimes(1);
});

test('image preloading skips missing and duplicate URLs and respects its range', () => {
  const images: string[] = [];
  vi.stubGlobal('Image', class { set src(url: string) { images.push(url); } });
  const { rerender } = renderHook(({ index, urls }) => useImagePreload(urls, index), { initialProps: { index: 1, urls: ['a', '', 'b', 'a', 'c'] } });
  expect(images).toEqual(['a', 'b']);
  rerender({ index: 3, urls: ['a', '', 'b', 'a', 'c'] });
  expect(images).toEqual(['a', 'b', 'c']);
  rerender({ index: 0, urls: [] });
  preloadImages([]); preloadImages(['', 'x']);
  expect(images).toEqual(['a', 'b', 'c', 'x']);
});

test('online status and scroll helpers follow browser state', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { result, unmount } = renderHook(useOnlineStatus);
  expect(result.current).toBe(true);
  act(() => { window.dispatchEvent(new Event('offline')); });
  expect(result.current).toBe(false);
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(result.current).toBe(true);
  unmount();
  const item = document.createElement('div');
  scrollIntoView({ current: null }, null);
  scrollIntoView({ current: item }, null);
  expect(item.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  const hook = renderHook(({ deps }) => useScrollIntoView({ current: item }, null, deps, 'center'), { initialProps: { deps: 0 as number | number[] } });
  hook.rerender({ deps: [1] });
  expect(item.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
});
