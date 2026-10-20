import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { media, talk } from '../../../../tests/fixtures';
import { usePlaybackPosition } from './usePlaybackPosition';
import { readPlaybackHistory } from '@/features/playback-history';
import { getSavedSubtitleLanguage, saveSubtitleLanguage } from './subtitleChoice';

test('playback saves progress, removes nearly finished watchlist items, and stops timers', () => {
  vi.useFakeTimers();
  const video = media(document.createElement('video'), { currentTime: 400 });
  const removeFromWatchlist = vi.fn().mockReturnValue(true);
  const ref = { current: video as HTMLVideoElement | null };
  const props = { event: talk(), videoElementRef: ref, isInWatchlist: true, removeFromWatchlist, playing: true };
  const { result, rerender, unmount } = renderHook(value => usePlaybackPosition(value), { initialProps: props });
  act(() => { vi.advanceTimersByTime(10000); });
  expect(removeFromWatchlist).toHaveBeenCalledWith('talk');
  expect(readPlaybackHistory()[0].positionSeconds).toBe(400);
  media(video, { paused: true });
  act(() => { vi.advanceTimersByTime(10000); });
  media(video, { paused: false, ended: true });
  act(() => { vi.advanceTimersByTime(10000); });
  media(video, { ended: false, duration: 0 }); video.currentTime = 200;
  act(() => { result.current.saveCurrentPosition(); });
  expect(readPlaybackHistory()[0].durationSeconds).toBe(600);
  rerender({ ...props, playing: false, isInWatchlist: false });
  act(() => { result.current.saveCurrentPosition(); });
  video.currentTime = 0; expect(result.current.saveCurrentPosition()).toBe(false);
  ref.current = null; expect(result.current.saveCurrentPosition()).toBe(false);
  ref.current = video; video.currentTime = 20;
  rerender({ ...props, event: talk({ guid: '' }) }); expect(result.current.saveCurrentPosition()).toBe(false);
  unmount();
});

test('subtitle choices validate storage, retain only recent choices, and handle storage failures', () => {
  expect(getSavedSubtitleLanguage()).toBeNull(); expect(getSavedSubtitleLanguage('')).toBeNull();
  for (const raw of ['bad', '{}', '[null,[],[""],["g",null]]']) {
    localStorage.setItem('subtitle_choices', raw); expect(getSavedSubtitleLanguage('g')).toBeNull();
  }
  saveSubtitleLanguage('', 'eng'); saveSubtitleLanguage('g', '');
  for (let index = 0; index < 101; index++) saveSubtitleLanguage(String(index), 'eng');
  expect(getSavedSubtitleLanguage('0')).toBeNull();
  expect(getSavedSubtitleLanguage('100')).toBe('eng');
  saveSubtitleLanguage('100', 'none'); expect(getSavedSubtitleLanguage('100')).toBe('none');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  expect(getSavedSubtitleLanguage('100')).toBeNull();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(() => saveSubtitleLanguage('g', 'eng')).not.toThrow();
});
