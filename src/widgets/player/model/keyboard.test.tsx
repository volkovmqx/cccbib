import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { usePlayerKeyboard } from './usePlayerKeyboard';
import { useControlsVisibility } from './useControlsVisibility';
import type { KeyboardContext } from './types';

function context(): KeyboardContext {
  return {
    onClose: vi.fn(), controls: { visible: true, focus: { area: 'none', id: null }, show: vi.fn(), hide: vi.fn(), focusButton: vi.fn(), focusProgress: vi.fn(), focusBack: vi.fn() },
    selector: null, selectorLength: 3, selectorIndex: 0, setSelectorIndex: vi.fn(), openSelector: vi.fn(), confirmSelector: vi.fn(), closeSelector: vi.fn(),
    buttons: ['playpause', 'disabled'].map(id => ({ id, align: 'center', label: id, icon: null, onPress: vi.fn(), disabled: id === 'disabled' })),
    backButton: false, hasMultipleLanguages: true, hasSubtitles: true, setPlaying: vi.fn(), seek: vi.fn(), toggleMute: vi.fn(),
  };
}
const key = (key: string, keyCode = 0) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, cancelable: true })); });

test('player keys control playback, seeking, mute, selectors, and exit', () => {
  vi.useFakeTimers();
  const ctx = context();
  const hook = renderHook(({ value }) => usePlayerKeyboard(value), { initialProps: { value: ctx } });
  for (const [name, code] of [['', 413], ['', 178]] as const) key(name, code);
  expect(ctx.onClose).toHaveBeenCalledTimes(2);
  for (const [name, code] of [['Escape', 0], ['Backspace', 0], ['', 461]] as const) key(name, code);
  expect(ctx.controls.hide).toHaveBeenCalledTimes(3);
  expect(ctx.onClose).toHaveBeenCalledTimes(2);
  const hidden = { ...ctx, controls: { ...ctx.controls, visible: false } };
  hook.rerender({ value: hidden });
  for (const [name, code] of [['Escape', 0], ['Backspace', 0], ['', 461]] as const) key(name, code);
  expect(ctx.controls.hide).toHaveBeenCalledTimes(3);
  expect(ctx.onClose).toHaveBeenCalledTimes(5);
  hook.rerender({ value: ctx });
  key('', 19); expect(ctx.setPlaying).toHaveBeenCalledWith(false);
  key('', 415);
  act(() => { vi.advanceTimersByTime(20); });
  expect(ctx.setPlaying).toHaveBeenCalledWith(true);
  for (const name of [' ', 'Spacebar', 'MediaPlayPause']) key(name);
  const update = vi.mocked(ctx.setPlaying).mock.calls.find(call => typeof call[0] === 'function')![0];
  if (typeof update !== 'function') throw Error('Missing toggle');
  expect(update(true)).toBe(false);
  key('ArrowDown'); expect(ctx.controls.focusProgress).toHaveBeenCalled();
  key('ArrowUp'); expect(ctx.controls.focusButton).toHaveBeenCalledWith('playpause');
  key('ArrowLeft'); key('ArrowRight'); expect(ctx.seek).toHaveBeenCalledWith(-10); expect(ctx.seek).toHaveBeenCalledWith(10);
  key('', 113); expect(ctx.toggleMute).toHaveBeenCalled();
  for (const [code, name] of [[799, 'subtitle'], [460, 'subtitle'], [403, 'language'], [457, 'language'], [404, 'speed'], [405, 'aspect']] as const) {
    hook.rerender({ value: { ...ctx } }); key('', code); expect(ctx.openSelector).toHaveBeenLastCalledWith(name);
  }
  hook.rerender({ value: { ...ctx, hasMultipleLanguages: false, hasSubtitles: false } });
  vi.mocked(ctx.openSelector).mockClear(); key('', 799); key('', 403); key('x');
  expect(ctx.openSelector).not.toHaveBeenCalled();
});

test('player button focus wraps and disabled buttons do not execute', () => {
  const ctx = context(); ctx.controls.focus = { area: 'buttons', id: 'playpause' };
  const { rerender } = renderHook(({ value }) => usePlayerKeyboard(value), { initialProps: { value: ctx } });
  key('ArrowLeft'); key('ArrowRight'); expect(ctx.controls.focusButton).toHaveBeenCalledWith('disabled');
  key('Enter'); expect(ctx.buttons[0].onPress).toHaveBeenCalled();
  key('Escape'); expect(ctx.controls.hide).toHaveBeenCalled();
  for (const id of ['disabled', 'missing']) {
    rerender({ value: { ...ctx, controls: { ...ctx.controls, focus: { area: 'buttons', id } } } }); key('Enter');
  }
  expect(ctx.buttons[1].onPress).not.toHaveBeenCalled();
});

test('with the back button enabled, up from the buttons focuses it and OK leaves the video', () => {
  const ctx = context(); ctx.backButton = true; ctx.controls.focus = { area: 'buttons', id: 'playpause' };
  const { rerender } = renderHook(({ value }) => usePlayerKeyboard(value), { initialProps: { value: ctx } });
  key('ArrowUp');
  expect(ctx.controls.focusBack).toHaveBeenCalledTimes(1);
  expect(ctx.controls.focusButton).not.toHaveBeenCalled();
  rerender({ value: { ...ctx, controls: { ...ctx.controls, focus: { area: 'back', id: null } } } });
  key('ArrowUp'); key('ArrowLeft'); key('ArrowRight');
  expect(ctx.seek).not.toHaveBeenCalled();
  expect(ctx.controls.focusBack).toHaveBeenCalledTimes(1);
  expect(ctx.controls.focusButton).not.toHaveBeenCalled();
  expect(ctx.onClose).not.toHaveBeenCalled();
  key('Enter'); expect(ctx.onClose).toHaveBeenCalledTimes(1);
  key('ArrowDown'); expect(ctx.controls.focusButton).toHaveBeenCalledWith('playpause');
  expect(ctx.controls.focusProgress).not.toHaveBeenCalled();
  key('Escape'); expect(ctx.controls.hide).toHaveBeenCalledTimes(1);
  expect(ctx.onClose).toHaveBeenCalledTimes(1);
});

test('up never reaches the back button when it is off or when the progress bar is focused', () => {
  const ctx = context(); ctx.controls.focus = { area: 'buttons', id: 'disabled' };
  const { rerender } = renderHook(({ value }) => usePlayerKeyboard(value), { initialProps: { value: ctx } });
  key('ArrowUp'); expect(ctx.controls.focusButton).toHaveBeenLastCalledWith('playpause');
  rerender({ value: { ...ctx, backButton: true, controls: { ...ctx.controls, focus: { area: 'progress', id: null } } } });
  key('ArrowUp'); expect(ctx.controls.focusButton).toHaveBeenCalledTimes(2);
  expect(ctx.controls.focusBack).not.toHaveBeenCalled();
});

test('selector keys consume navigation and return focus to the selector button', () => {
  const ctx = { ...context(), selector: 'subtitle' as const };
  renderHook(() => usePlayerKeyboard(ctx));
  key('ArrowDown'); key('ArrowUp');
  const calls = vi.mocked(ctx.setSelectorIndex).mock.calls;
  expect(typeof calls[0][0] === 'function' && calls[0][0](2)).toBe(0);
  expect(typeof calls[1][0] === 'function' && calls[1][0](0)).toBe(2);
  key('Enter'); expect(ctx.confirmSelector).toHaveBeenCalledWith(0);
  key('Escape'); expect(ctx.closeSelector).toHaveBeenCalled();
  expect(ctx.controls.focusButton).toHaveBeenCalledWith('subtitle');
  vi.mocked(ctx.controls.show).mockClear(); key('', 413);
  expect(ctx.controls.show).not.toHaveBeenCalled();
});

test('controls hide only when playback has no focused control or open selector', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(props => useControlsVisibility(props), { initialProps: { selectorOpen: false, playing: true } });
  act(() => { vi.advanceTimersByTime(4000); }); expect(result.current.visible).toBe(false);
  act(() => { result.current.show(); result.current.focusButton('playpause'); vi.advanceTimersByTime(4000); });
  expect(result.current.visible).toBe(true);
  act(() => { result.current.focusProgress(); }); expect(result.current.focus.area).toBe('progress');
  act(() => { result.current.focusBack(); vi.advanceTimersByTime(4000); });
  expect(result.current.focus).toEqual({ area: 'back', id: null });
  expect(result.current.visible).toBe(true);
  act(() => { result.current.hide(); }); expect(result.current.focus.area).toBe('none');
  rerender({ selectorOpen: true, playing: true });
  act(() => { result.current.show(); vi.advanceTimersByTime(4000); }); expect(result.current.visible).toBe(true);
  rerender({ selectorOpen: false, playing: false });
  act(() => { vi.advanceTimersByTime(4000); }); expect(result.current.visible).toBe(true);
});
