import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Preview } from './Preview';
import { talk } from '../../../../tests/fixtures';
import { setSetting } from '@/shared/config';

beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  setSetting('language', 'deu'); setSetting('previewVideo', 'still');
});

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const videoOf = (view: { container: HTMLElement }) => view.container.querySelector('video') as HTMLVideoElement;
const pictures = (view: { container: HTMLElement }) => view.container.querySelectorAll('.previewBackdrop__img');
const covered = (view: { container: HTMLElement }) => view.container.querySelector('.previewCover') !== null;
const setTime = (video: HTMLVideoElement, value: number) => Object.defineProperty(video, 'currentTime', { value, configurable: true });
const start = (video: HTMLVideoElement, at = 0) => { setTime(video, at); fireEvent.playing(video); };
const move = (video: HTMLVideoElement, to: number) => { setTime(video, to); fireEvent.timeUpdate(video); };

test('the picture mode shows the title and the picture, first small and then sharp, and never a video', () => {
  const view = render(<Preview event={talk()} />);
  expect(screen.getByText('Test talk')).toBeVisible();
  expect(pictures(view)).toHaveLength(1);
  advance(250);
  expect(pictures(view)).toHaveLength(2);
  expect(pictures(view)[1]).toHaveStyle({ opacity: 0 });
  fireEvent.load(pictures(view)[1]);
  expect(pictures(view)[1]).toHaveStyle({ opacity: 1 });
  advance(2000);
  expect(videoOf(view)).not.toBeInTheDocument();
});

test('a talk without a recording says so, and Off hides the picture and that note', () => {
  const view = render(<Preview event={talk({ guid: 'other', images: {}, videos: [], subtitles: undefined })} />);
  expect(screen.getByText('No recording available')).toBeVisible();
  expect(view.container.querySelector('.previewBackdrop')).toBeInTheDocument();
  act(() => { setSetting('previewVideo', 'none'); });
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  expect(screen.queryByText('No recording available')).not.toBeInTheDocument();
  view.rerender(<Preview event={talk()} />);
  advance(2000);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  expect(videoOf(view)).not.toBeInTheDocument();
});

test('the video modes show no picture before the video and keep a cover over the video until it has moved', () => {
  setSetting('previewVideo', 'on');
  const view = render(<Preview event={talk()} />);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  expect(videoOf(view)).not.toBeInTheDocument();
  advance(40);
  const video = videoOf(view);
  expect(video).toBeInTheDocument();
  expect(video.getAttribute('src')).toContain('#t=');
  expect(video.style.visibility).toBe('');
  expect(covered(view)).toBe(true);
  fireEvent.timeUpdate(video);
  expect(covered(view)).toBe(true);
  start(video, 12);
  move(video, 12.05);
  expect(covered(view)).toBe(true);
  move(video, 12.2);
  expect(covered(view)).toBe(false);
  expect(video.muted).toBe(false);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  advance(5000);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
});

test('a clock that jumps back after the first picture counts from where it landed', () => {
  setSetting('previewVideo', 'on');
  const view = render(<Preview event={talk()} />);
  advance(40);
  const video = videoOf(view);
  start(video, 459);
  move(video, 459);
  expect(covered(view)).toBe(true);
  move(video, 450.5);
  expect(covered(view)).toBe(true);
  move(video, 450.55);
  expect(covered(view)).toBe(true);
  move(video, 450.7);
  expect(covered(view)).toBe(false);
});

test('the sound of the Video mode waits until the cover lifts, the Mute mode never plays it', () => {
  setSetting('previewVideo', 'on');
  const view = render(<Preview event={talk()} />);
  advance(40);
  const video = videoOf(view);
  const tracks = [{ enabled: true }, { enabled: true }];
  Object.defineProperty(video, 'audioTracks', { value: tracks, configurable: true });
  fireEvent.loadedMetadata(video);
  expect(tracks.map((track) => track.enabled)).toEqual([false, false]);
  start(video, 12);
  expect(tracks.map((track) => track.enabled)).toEqual([false, false]);
  move(video, 12.2);
  expect(covered(view)).toBe(false);
  expect(tracks.map((track) => track.enabled)).toEqual([true, true]);
  act(() => { setSetting('previewVideo', 'mute'); });
  fireEvent.playing(video);
  expect(tracks.map((track) => track.enabled)).toEqual([false, false]);
});

test('the mute mode starts muted and switches the audio tracks off', () => {
  setSetting('previewVideo', 'mute');
  const view = render(<Preview event={talk()} />);
  advance(40);
  const video = videoOf(view);
  expect(video.muted).toBe(true);
  const tracks = [{ enabled: true }, { enabled: true }];
  Object.defineProperty(video, 'audioTracks', { value: tracks, configurable: true });
  fireEvent.loadedMetadata(video);
  expect(tracks.map((track) => track.enabled)).toEqual([false, false]);
  tracks[0].enabled = true;
  fireEvent.playing(video);
  expect(tracks[0].enabled).toBe(false);
  act(() => { setSetting('previewVideo', 'on'); });
  tracks[1].enabled = true;
  fireEvent.playing(video);
  expect(tracks[1].enabled).toBe(false);
  move(video, 0.5);
  expect(tracks[1].enabled).toBe(true);
  Object.defineProperty(video, 'audioTracks', { value: undefined, configurable: true });
  expect(() => fireEvent.playing(video)).not.toThrow();
});

test('the video sits in the top right corner with the shape of the video, from the listed size first and the real size once it is known', () => {
  setSetting('previewVideo', 'on');
  const shaped = (width: number, height: number, guid: string) => talk({ guid, videos: [{ ...talk().videos[0], width, height }] });
  const view = render(<Preview event={shaped(1920, 1080, 'wide')} />);
  advance(40);
  const box = () => [videoOf(view).style.width, videoOf(view).style.height];
  expect(box()).toEqual(['100%', '100%']);
  view.rerender(<Preview event={shaped(640, 480, 'square')} />);
  advance(1000);
  expect(box()).toEqual(['75%', '100%']);
  const video = videoOf(view);
  Object.defineProperty(video, 'videoWidth', { value: 1000, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: 500, configurable: true });
  fireEvent.loadedMetadata(video);
  expect(box()).toEqual(['100%', '88.89%']);
  Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
  fireEvent.loadedMetadata(video);
  expect(box()).toEqual(['100%', '88.89%']);
  view.rerender(<Preview event={shaped(1920, 1080, 'again')} />);
  advance(1000);
  expect(box()).toEqual(['100%', '100%']);
});

test('a new talk waits longer while the selection keeps changing and never starts a video for the old selection', () => {
  setSetting('previewVideo', 'on');
  const view = render(<Preview event={talk({ guid: 'a' })} />);
  advance(40);
  expect(videoOf(view)).toBeInTheDocument();
  view.rerender(<Preview event={talk({ guid: 'b' })} />);
  expect(videoOf(view)).not.toBeInTheDocument();
  advance(249);
  expect(videoOf(view)).not.toBeInTheDocument();
  advance(1);
  expect(videoOf(view)).toBeInTheDocument();
  advance(1000);
  view.rerender(<Preview event={talk({ guid: 'c' })} />);
  expect(videoOf(view)).not.toBeInTheDocument();
  advance(40);
  expect(videoOf(view)).toBeInTheDocument();
});

test('the picture stands in where no video can play: no recording, failed sources or no input for two minutes', () => {
  setSetting('previewVideo', 'on');
  const view = render(<Preview event={talk({ guid: 'none', images: talk().images, videos: [] })} />);
  advance(2000);
  expect(pictures(view).length).toBeGreaterThan(0);
  expect(screen.getByText('No recording available')).toBeVisible();
  expect(videoOf(view)).not.toBeInTheDocument();

  view.rerender(<Preview event={talk({ guid: 'broken' })} />);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  advance(40);
  const video = videoOf(view);
  expect(video).toBeInTheDocument();
  fireEvent.error(video);
  expect(videoOf(view)).not.toBeInTheDocument();
  expect(pictures(view).length).toBeGreaterThan(0);
  expect(screen.queryByText('No recording available')).not.toBeInTheDocument();

  view.rerender(<Preview event={talk({ guid: 'quiet' })} />);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  advance(1000);
  expect(videoOf(view)).toBeInTheDocument();
  advance(120000);
  expect(videoOf(view)).not.toBeInTheDocument();
  expect(pictures(view).length).toBeGreaterThan(0);
  act(() => { window.dispatchEvent(new Event('keydown')); });
  advance(1000);
  expect(videoOf(view)).toBeInTheDocument();
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
});

test('a browser that refuses the video falls back to the picture, other play errors do not', async () => {
  setSetting('previewVideo', 'on');
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
  const view = render(<Preview event={talk({ guid: 'a' })} />);
  await act(async () => { vi.advanceTimersByTime(40); });
  expect(videoOf(view)).toBeInTheDocument();
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  view.rerender(<Preview event={talk({ guid: 'b' })} />);
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(videoOf(view)).not.toBeInTheDocument();
  expect(pictures(view).length).toBeGreaterThan(0);
  view.rerender(<Preview event={talk({ guid: 'c' })} />);
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(videoOf(view)).toBeInTheDocument();
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
});

test('the preview releases its decoder and waits when the player opens, and shows nothing behind it', () => {
  setSetting('previewVideo', 'on');
  const value = talk();
  const view = render(<Preview event={value} disableVideo />);
  advance(2000);
  expect(videoOf(view)).not.toBeInTheDocument();
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  view.rerender(<Preview event={value} />);
  expect(videoOf(view)).not.toBeInTheDocument();
  advance(1000);
  const video = videoOf(view);
  expect(video).toBeInTheDocument();
  fireEvent.playing(video);
  view.rerender(<Preview event={value} disableVideo />);
  expect(videoOf(view)).not.toBeInTheDocument();
  expect(video.pause).toHaveBeenCalled();
  expect(video.load).toHaveBeenCalled();
  act(() => { setSetting('previewVideo', 'still'); });
  expect(view.container.querySelector('.previewBackdrop')).toBeInTheDocument();
});

test('the language, subtitle and aspect marks show when the talk has them', () => {
  const value = talk({ subtitles: [{ url: 'eng.vtt', language: 'eng', mimeType: 'text/vtt' }], videos: [talk().videos[0], { ...talk().videos[0], language: 'eng' }] });
  const view = render(<Preview event={value} />);
  expect(view.container.querySelectorAll('.previewMeta__item').length).toBeGreaterThanOrEqual(5);
});
