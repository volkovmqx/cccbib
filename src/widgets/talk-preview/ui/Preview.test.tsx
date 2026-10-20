import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Preview } from './Preview';
import { talk } from '../../../../tests/fixtures';
import { setSetting } from '@/shared/config';

beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  setSetting('language', 'deu'); setSetting('previewVideo', 'on');
});

test('preview delays video and poster loading and silences audio tracks in mute mode', () => {
  const value = talk({ subtitles: [{ url: 'eng.vtt', language: 'eng', mimeType: 'text/vtt' }], videos: [talk().videos[0], { ...talk().videos[0], language: 'eng' }] });
  const view = render(<Preview event={value} />);
  expect(screen.getByText('Test talk')).toBeVisible();
  expect(view.container.querySelector('video')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(300); });
  const video = view.container.querySelector('video')!;
  expect(video).toBeInTheDocument();
  const poster = view.container.querySelectorAll('.previewBackdrop__img')[1];
  expect(poster).toHaveStyle({ opacity: 0 });
  fireEvent.load(poster); expect(poster).toHaveStyle({ opacity: 1 });
  fireEvent.loadedMetadata(video);
  act(() => { setSetting('previewVideo', 'mute'); });
  const tracks = [{ enabled: true }]; Object.defineProperty(video, 'audioTracks', { value: tracks, configurable: true });
  fireEvent.loadedMetadata(video); expect(tracks[0].enabled).toBe(false);
  fireEvent.playing(video); fireEvent.error(video);
  expect(video.getAttribute('src')).toContain('#t=');
  act(() => { vi.advanceTimersByTime(120000); });
  expect(view.container.querySelector('video')).not.toBeInTheDocument();
  view.rerender(<Preview event={talk({ guid: 'other', images: {}, videos: [], subtitles: undefined })} />);
  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.getByText('No recording available')).toBeVisible();
  act(() => { setSetting('previewVideo', 'none'); });
  expect(screen.queryByText('No recording available')).not.toBeInTheDocument();
});

test('preview stops its decoder when disabled and supports still images', () => {
  const value = talk();
  const view = render(<Preview event={value} disableVideo />);
  act(() => { vi.advanceTimersByTime(300); });
  expect(view.container.querySelector('video')).not.toBeInTheDocument();
  view.rerender(<Preview event={value} />);
  act(() => { vi.advanceTimersByTime(300); });
  const video = view.container.querySelector('video')!;
  expect(video).toBeInTheDocument();
  fireEvent.playing(video);
  view.rerender(<Preview event={value} disableVideo />);
  expect(video.pause).toHaveBeenCalled(); expect(video.load).toHaveBeenCalled();
  act(() => { setSetting('previewVideo', 'still'); });
  expect(view.container.querySelector('.previewBackdrop')).toBeInTheDocument();
});
