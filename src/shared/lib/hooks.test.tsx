import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { useDelayedFlag, useIdle, useWindowEvent } from './utils';
import { useMediaQuery } from './useMediaQuery';
import { isWebOS } from './platform';
import { useListNavigation } from './useListNavigation';
import { useImagePreload } from './useImagePreload';
import { useOnlineStatus } from './useOnlineStatus';
import { scrollIntoView } from './scrollHelpers';
import { pointerMoved, useWheelNavigation } from './pointer';

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

test('empty lists keep Back and sidebar navigation usable', () => {
  const onClose = vi.fn(); const onSelect = vi.fn(); const onFocusSidebar = vi.fn(); const setSelectedIndex = vi.fn();
  renderHook(() => useListNavigation({ itemCount: 0, selectedIndex: 0, setSelectedIndex, onClose, onSelect, onFocusSidebar, sidebarFocused: false }));
  for (const [key, keyCode] of [['Unidentified', 461], ['ArrowLeft', 37], ['ArrowDown', 40], ['ArrowUp', 38], ['Enter', 13]] as const) {
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, cancelable: true })); });
  }
  expect(onClose).toHaveBeenCalledOnce();
  expect(onFocusSidebar).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
  expect(setSelectedIndex).not.toHaveBeenCalled();
});

test('image preloading skips missing and duplicate URLs and respects its range', () => {
  const images: string[] = [];
  vi.stubGlobal('Image', class { set src(url: string) { images.push(url); } });
  const { rerender } = renderHook(({ index, urls }) => useImagePreload(urls, index), { initialProps: { index: 1, urls: ['a', '', 'b', 'a', 'c'] } });
  expect(images).toEqual(['a', 'b']);
  rerender({ index: 3, urls: ['a', '', 'b', 'a', 'c'] });
  expect(images).toEqual(['a', 'b', 'c']);
  rerender({ index: 0, urls: [] });
  expect(images).toEqual(['a', 'b', 'c']);
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
  scrollIntoView({ current: item }, null, 'center');
  expect(item.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
});


test('a selection that follows the pointer is not scrolled into view', () => {
  const item = document.createElement('div');
  item.scrollIntoView = vi.fn();
  pointerMoved({ nativeEvent: new Event('mousemove'), clientX: 801, clientY: 802 });
  scrollIntoView({ current: item }, null);
  expect(item.scrollIntoView).not.toHaveBeenCalled();
  const { unmount } = renderHook(() => useWheelNavigation());
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  scrollIntoView({ current: item }, null);
  expect(item.scrollIntoView).toHaveBeenCalledTimes(1);
  unmount();
});

test('a flag is raised only after it has stayed on for the delay and drops at once', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 500), { initialProps: { active: false } });
  expect(result.current).toBe(false);
  rerender({ active: true });
  act(() => { vi.advanceTimersByTime(499); });
  expect(result.current).toBe(false);
  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current).toBe(true);
  rerender({ active: false });
  expect(result.current).toBe(false);
  rerender({ active: true });
  expect(result.current).toBe(false);
  act(() => { vi.advanceTimersByTime(300); });
  rerender({ active: false });
  act(() => { vi.advanceTimersByTime(600); });
  expect(result.current).toBe(false);
});

test('a media query hook follows the window and falls back to false without matchMedia', () => {
  const original = window.matchMedia;
  expect(renderHook(() => useMediaQuery('(max-width: 599px)')).result.current).toBe(false);
  const listeners = new Set<() => void>();
  const list = { matches: true, addListener: (callback: () => void) => listeners.add(callback), removeListener: (callback: () => void) => listeners.delete(callback) };
  window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia;
  const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 599px)'));
  expect(result.current).toBe(true);
  list.matches = false;
  act(() => { listeners.forEach((callback) => callback()); });
  expect(result.current).toBe(false);
  unmount();
  expect(listeners.size).toBe(0);
  window.matchMedia = original;
});

test('the platform check looks for the webOS service bridge', () => {
  expect(isWebOS()).toBe(false);
  vi.stubGlobal('PalmServiceBridge', class {});
  expect(isWebOS()).toBe(true);
  vi.unstubAllGlobals();
});
