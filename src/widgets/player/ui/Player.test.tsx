import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Player } from './Player';
import { media, talk } from '../../../../tests/fixtures';
import { setSetting } from '@/shared/config';
import { dispatchCommand, queuePlayerCommand } from '@/features/remote-control';
import type { RemoteCommand } from '@/features/remote-control';
import { readPlaybackHistory } from '@/features/playback-history';
import { readWatchlist } from '@/features/watchlist';
import { readNowPlaying } from '../model/nowPlaying';

const subtitle = vi.hoisted(() => ({ status: 'idle', options: ['none', 'eng'], available: true }));
vi.mock('../model/useOutputWindow', () => ({ useOutputWindow: vi.fn() }));
vi.mock('../model/useSubtitleManagement', () => ({ useSubtitleManagement: () => {
  const [language, setLanguage] = useState('none');
  return { subtitleLanguage: language, setSubtitleLanguage: setLanguage, subtitleStatus: subtitle.status, subtitleOptions: subtitle.options, hasSubtitles: subtitle.available };
} }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(600);
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true);
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
  for (const [key, value] of [['language', 'deu'], ['subtitleLanguage', 'none'], ['aspectRatio', 'auto'], ['uiLanguage', 'en']] as const) setSetting(key, value);
  subtitle.status = 'idle'; subtitle.available = true; subtitle.options = ['none', 'eng'];
});
function setup(options: { event?: ReturnType<typeof talk>; startAt?: number } = {}) {
  const onClose = vi.fn();
  const view = render(<Player event={options.event || talk()} onClose={onClose} startAt={options.startAt} />);
  const video = () => view.container.querySelector('video')!;
  return { ...view, video, onClose };
}
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const command = (value: RemoteCommand) => act(() => { dispatchCommand(value); });

test('player controls playback, watchlist, seeking, mute, and closes after completion', async () => {
  const view = setup(); const video = view.video();
  expect(readNowPlaying()?.event.guid).toBe('talk');
  await tick(200);
  expect(video.src).toContain('test.webm');
  fireEvent.loadedMetadata(video); fireEvent.canPlay(video); fireEvent.playing(video);
  expect(document.title).toBe('Playing: Test talk');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(video.pause).toHaveBeenCalled(); expect(document.title).toBe('Paused: Test talk');
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.play(video); fireEvent.pause(video); fireEvent.play(video);
  fireEvent.click(screen.getByRole('button', { name: 'Mute' })); expect(video.muted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Unmute' })); expect(video.muted).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Watchlist' })); expect(readWatchlist()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Skip Forward' })); expect(video.currentTime).toBe(10);
  fireEvent.click(screen.getByRole('button', { name: 'Skip Back' })); expect(video.currentTime).toBe(0);
  const progress = view.container.querySelector('.playerProgress__barWrapper')!;
  vi.spyOn(progress, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
  fireEvent.click(progress, { clientX: 25 }); expect(video.currentTime).toBe(150);
  fireEvent.waiting(video); expect(view.container.querySelector('.player-buffering')).toBeInTheDocument();
  fireEvent.canPlay(video); expect(view.container.querySelector('.player-buffering')).not.toBeInTheDocument();
  fireEvent.mouseMove(view.container.querySelector('.player-wrapper')!);
  fireEvent.click(video); fireEvent.click(video);
  video.currentTime = 599; fireEvent.ended(video);
  expect(view.onClose).toHaveBeenCalled(); expect(readWatchlist()).toEqual([]); expect(readPlaybackHistory()).toEqual([]);
  view.unmount(); expect(readNowPlaying()).toBeNull();
});

test('player selectors pause when required, preserve playback position, and apply choices', async () => {
  const value = talk({ videos: [talk().videos[0], { ...talk().videos[0], url: 'https://static.media.ccc.de/eng.webm', language: 'eng' }] });
  const view = setup({ event: value });
  view.video().currentTime = 100;
  fireEvent.click(screen.getByRole('button', { name: 'German' }));
  expect(document.title).toContain('Paused:');
  fireEvent.click(screen.getByText('English'));
  expect(document.title).toContain('Playing:');
  await tick(200);
  expect(view.video().getAttribute('src')).toContain('eng.webm');
  fireEvent.seeked(view.video()); fireEvent.seeked(view.video()); await tick(150);
  fireEvent.click(screen.getByRole('button', { name: 'Subtitles Off' }));
  fireEvent.click(screen.getByText('English'));
  expect(screen.getByRole('button', { name: 'Subtitles (English)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Aspect:/ }));
  fireEvent.click(screen.getByText('Zoom'));
  expect(view.video()).toHaveStyle({ objectFit: 'cover' });
  expect(screen.getByText('Aspect ratio: Zoom')).toBeInTheDocument();
  await tick(3000); expect(screen.queryByText('Aspect ratio: Zoom')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
  command({ cmd: 'pause' });
  fireEvent.click(screen.getByRole('button', { name: 'English' }));
  fireEvent.click(view.container.querySelector('.picker__overlay')!);
  expect(document.title).toContain('Paused:');
});

test('remote player commands apply only valid arguments', async () => {
  queuePlayerCommand({ cmd: 'mute', value: true });
  const view = setup(); const video = view.video();
  expect(video.muted).toBe(true);
  command({ cmd: 'pause' }); command({ cmd: 'resume' }); command({ cmd: 'toggle' });
  command({ cmd: 'mute' }); expect(video.muted).toBe(false);
  command({ cmd: 'aspect', value: 'stretch' }); expect(video).toHaveStyle({ objectFit: 'fill' });
  command({ cmd: 'aspect', value: 'invalid' });
  command({ cmd: 'subtitle', value: 'eng' });
  command({ cmd: 'language', value: 'deu' });
  command({ cmd: 'language', value: 'invalid' });
  command({ cmd: 'seek', by: 20 }); expect(video.currentTime).toBe(20);
  command({ cmd: 'seek', to: 50 }); expect(video.currentTime).toBe(50);
  media(video, { readyState: 0 }); command({ cmd: 'seek', to: 80 });
  command({ cmd: 'seek' }); command({ cmd: 'subtitle', value: false });
  command({ cmd: 'stop' }); expect(view.onClose).toHaveBeenCalled();
  await tick(200);
});

test.each([120, 1000])('resume seeks after metadata, settles twice, and starts playback at %s', async startAt => {
  const view = setup({ startAt }); const video = view.video();
  expect(video.currentTime).toBe(Math.min(startAt, 595));
  fireEvent.canPlay(video); expect(view.container.querySelector('.player-buffering')).toBeInTheDocument();
  fireEvent.loadedMetadata(video); fireEvent.loadedData(video);
  fireEvent.seeked(video); fireEvent.seeked(video); await tick(150);
  expect(video.currentTime).toBeCloseTo(Math.min(startAt, 595) + 0.01);
  expect(video.play).toHaveBeenCalled();
});

test('resume waits for metadata and falls back when seek events do not arrive', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(0);
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(Infinity);
  const view = setup({ startAt: 120 }); const video = view.video();
  expect(video.currentTime).toBe(0);
  media(video, { duration: Infinity, paused: true }); fireEvent.loadedData(video);
  expect(video.currentTime).toBe(120);
  await tick(8150); expect(video.play).toHaveBeenCalled();
});

test('resume and playback tolerate media API exceptions and old play return values', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation(() => { throw Error('seek denied'); });
  const view = setup({ startAt: 120 });
  await tick(150);
  expect(console.error).toHaveBeenCalledWith('Could not resume playback', expect.any(Error));
  expect(view.video().play).toHaveBeenCalled();
  view.unmount();
  vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(undefined as unknown as Promise<void>).mockRejectedValueOnce(Error('autoplay'));
  const next = setup();
  await act(async () => { fireEvent.canPlay(next.video()); });
  expect(next.video().play).toHaveBeenCalled();
});

test('source errors advance through mirrors and report failure after all sources fail', async () => {
  const view = setup({ event: talk({ videos: [{ ...talk().videos[0], url: 'https://cdn.media.ccc.de/test.webm' }] }) });
  await tick(200);
  let previous = view.video().getAttribute('src');
  view.video().currentTime = 40;
  for (let index = 0; index < 3; index++) {
    fireEvent.error(view.video());
    expect(view.video().getAttribute('src')).not.toBe(previous);
    previous = view.video().getAttribute('src');
  }
  fireEvent.error(view.video());
  expect(screen.getByText('This video could not be played')).toBeVisible();
});

test('source startup and seeking timeouts detect stalled media', async () => {
  const view = setup();
  media(view.video(), { readyState: 0 });
  await tick(12000);
  expect(screen.getByText('This video could not be played')).toBeVisible();
  view.unmount();
  const next = setup();
  media(next.video(), { seeking: true, paused: false });
  await tick(8000);
  expect(screen.getByText('This video could not be played')).toBeVisible();
});

test('stalled picture and clock detection attempts a recovery seek', async () => {
  const view = setup(); const video = media(view.video(), { paused: false, webkitDecodedFrameCount: 0 });
  video.currentTime = 20;
  await tick(4000); video.webkitDecodedFrameCount = 1;
  await tick(4000); await tick(4000);
  expect(video.currentTime).toBe(19);
  media(video, { paused: true }); await tick(4000);
  media(video, { paused: false, seeking: true }); await tick(4000);
});

test('seek nudges settle video and skip paused, ended, and active seeking states', async () => {
  const view = setup(); const video = media(view.video(), { paused: false });
  video.currentTime = 10;
  fireEvent.seeked(video); await tick(300); expect(video.currentTime).toBeCloseTo(10.01);
  fireEvent.seeked(video); await tick(300); expect(video.currentTime).toBeCloseTo(10.01);
  for (const state of [{ paused: true }, { ended: true }, { seeking: true }]) {
    media(video, state); fireEvent.seeked(video); await tick(300); expect(video.currentTime).toBeCloseTo(10.01);
  }
  media(video, { paused: false });
  vi.spyOn(video, 'currentTime', 'set').mockImplementation(() => { throw Error('seek'); });
  fireEvent.seeked(video); await tick(300);
});

test('player renders missing recordings and language and aspect fallbacks', async () => {
  const view = setup({ event: talk({ videos: [] }) });
  expect(screen.getByText('No recording available')).toBeVisible();
  command({ cmd: 'seek', to: 20 }); command({ cmd: 'seek', by: 10 }); command({ cmd: 'pause' });
  view.unmount();
  setSetting('language', 'auto'); setSetting('aspectRatio', 'invalid');
  subtitle.status = 'error'; subtitle.available = false;
  const next = setup({ event: talk({ videos: [{ ...talk().videos[0], mimeType: 'video/mp4', language: 'deu-eng' }] }) });
  expect(screen.getByText('Subtitles are not available for this talk')).toBeInTheDocument();
  await tick(3000); expect(screen.queryByText('Subtitles are not available for this talk')).not.toBeInTheDocument();
  next.unmount();
  const multi = setup({ event: talk({ videos: [{ ...talk().videos[0], language: 'deu-eng' }] }) });
  expect(screen.getByRole('button', { name: /Multi-Audio/ })).toBeInTheDocument();
  multi.unmount();
});
