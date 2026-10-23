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
  window.innerWidth = 1920; window.innerHeight = 1080;
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
  expect(document.title).toBe('CCCBib - Test talk');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(video.pause).toHaveBeenCalled(); expect(document.title).toBe('CCCBib - Test talk');
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.play(video); fireEvent.pause(video); fireEvent.play(video);
  fireEvent.click(screen.getByRole('button', { name: 'Mute' })); expect(video.muted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Unmute' })); expect(video.muted).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Add to Watchlist' })); expect(readWatchlist()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Skip Forward' })); expect(video.currentTime).toBe(10);
  fireEvent.click(screen.getByRole('button', { name: 'Skip Back' })); expect(video.currentTime).toBe(0);
  const progress = view.container.querySelector('.playerProgress__barWrapper')!;
  vi.spyOn(progress, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
  fireEvent.mouseDown(progress, { clientX: 25 }); fireEvent.mouseUp(window, { clientX: 25 }); expect(video.currentTime).toBe(150);
  fireEvent.waiting(video); await tick(799);
  expect(view.container.querySelector('.player-buffering')).not.toBeInTheDocument();
  await tick(1); expect(view.container.querySelector('.player-buffering')).toBeInTheDocument();
  fireEvent.canPlay(video); expect(view.container.querySelector('.player-buffering')).not.toBeInTheDocument();
  fireEvent.waiting(video); await tick(300); fireEvent.canPlay(video); await tick(1000);
  expect(view.container.querySelector('.player-buffering')).not.toBeInTheDocument();
  fireEvent.mouseMove(view.container.querySelector('.player-wrapper')!);
  fireEvent.click(video); fireEvent.click(video);
  video.currentTime = 599; fireEvent.ended(video);
  expect(view.onClose).not.toHaveBeenCalled();
  await tick(1000);
  expect(view.onClose).toHaveBeenCalled(); expect(readWatchlist()).toEqual([]); expect(readPlaybackHistory()).toEqual([]);
  view.unmount(); expect(readNowPlaying()).toBeNull();
});

test('the back button is hidden by default and leaves the video by click or remote when enabled', async () => {
  const hidden = setup();
  await tick(200);
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  hidden.unmount();
  setSetting('osdBackButton', 'on');
  const view = setup();
  await tick(200);
  const back = screen.getByRole('button', { name: 'Back' });
  fireEvent.click(back); await tick(1000); expect(view.onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  const second = setup();
  await tick(200);
  const secondBack = screen.getByRole('button', { name: 'Back' });
  const key = (name: string) => act(() => { fireEvent.keyDown(window, { key: name }); });
  key('ArrowDown'); key('ArrowUp');
  expect(screen.getByRole('button', { name: 'Pause' })).toHaveClass('playerUI__button--focused');
  expect(secondBack).not.toHaveClass('playerUI__button--focused');
  key('ArrowUp');
  expect(secondBack).toHaveClass('playerUI__button--focused');
  key('Enter'); await tick(1000); expect(second.onClose).toHaveBeenCalledTimes(1);
});

test('back hides the controls and with them the cursor first and only leaves the video once they are hidden', async () => {
  const view = setup();
  await tick(200);
  const wrapper = view.container.querySelector('.player-wrapper')!;
  const key = (name: string) => act(() => { fireEvent.keyDown(window, { key: name }); });
  expect(wrapper).toHaveClass('player-wrapper--controls-visible');
  key('Escape');
  expect(wrapper).toHaveClass('player-wrapper--controls-hidden');
  expect(view.onClose).not.toHaveBeenCalled();
  fireEvent.mouseMove(wrapper);
  expect(wrapper).toHaveClass('player-wrapper--controls-visible');
  key('Backspace');
  expect(wrapper).toHaveClass('player-wrapper--controls-hidden');
  expect(view.onClose).not.toHaveBeenCalled();
  fireEvent.mouseMove(wrapper);
  await tick(4100);
  expect(wrapper).toHaveClass('player-wrapper--controls-hidden');
  key('Escape');
  await tick(1000);
  expect(view.onClose).toHaveBeenCalledTimes(1);
});

test('the stats for nerds button appears only when enabled and toggles the stats panel', async () => {
  const hidden = setup();
  await tick(200);
  expect(screen.queryByRole('button', { name: 'Stats for Nerds' })).not.toBeInTheDocument();
  hidden.unmount();
  setSetting('statsForNerds', 'on');
  setup();
  await tick(200);
  const bug = screen.getByRole('button', { name: 'Stats for Nerds' });
  expect(screen.queryByRole('region', { name: 'Stats for Nerds' })).not.toBeInTheDocument();
  fireEvent.click(bug);
  const panel = screen.getByRole('region', { name: 'Stats for Nerds' });
  for (const text of ['Mirror', 'static.media.ccc.de', 'Resolution', 'Buffer', 'Buffer fill', 'Source', '1 of 1']) expect(panel).toHaveTextContent(text);
  await tick(1000);
  expect(panel).toHaveTextContent('Position');
  fireEvent.click(bug);
  expect(panel).not.toBeInTheDocument();
});

test('player selectors pause when required, preserve playback position, and apply choices', async () => {
  const value = talk({ videos: [talk().videos[0], { ...talk().videos[0], url: 'https://static.media.ccc.de/eng.webm', language: 'eng' }] });
  const view = setup({ event: value });
  view.video().currentTime = 100;
  fireEvent.click(screen.getByRole('button', { name: 'German' }));
  fireEvent.click(screen.getByText('English'));
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
  command({ cmd: 'stop' }); await tick(1000); expect(view.onClose).toHaveBeenCalled();
  await tick(200);
});

test.each([120, 1000])('resume seeks after metadata, settles twice, and starts playback at %s', async startAt => {
  const view = setup({ startAt }); const video = view.video();
  expect(video.currentTime).toBe(Math.min(startAt, 595));
  fireEvent.canPlay(video); await tick(800); expect(view.container.querySelector('.player-buffering')).toBeInTheDocument();
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

test('leaving hides the video and shows the page at once, lets go of the decoder a moment later and removes the layer after that, once', async () => {
  setSetting('osdBackButton', 'on');
  const view = setup();
  await tick(200);
  const video = view.video();
  video.currentTime = 123;
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(view.container.querySelector('video')).toBe(video);
  expect(video.muted).toBe(true);
  expect(video.pause).toHaveBeenCalled();
  expect(view.container.querySelector('.player-wrapper')).toHaveClass('player-wrapper--closing');
  expect(document.documentElement).toHaveAttribute('data-player-closing');
  act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
  await tick(299);
  expect(view.container.querySelector('video')).toBe(video);
  await tick(1);
  expect(view.container.querySelector('video')).toBeNull();
  expect(video.getAttribute('src')).toBeNull();
  await tick(699);
  expect(view.onClose).not.toHaveBeenCalled();
  await tick(1);
  expect(view.onClose).toHaveBeenCalledTimes(1);
  await tick(3000);
  expect(view.onClose).toHaveBeenCalledTimes(1);
  expect(readPlaybackHistory()[0].positionSeconds).toBe(123);
  view.unmount();
  expect(document.documentElement).not.toHaveAttribute('data-player-closing');
});

test('a player that is taken away while it is leaving does not leave again', async () => {
  const view = setup();
  await tick(200);
  command({ cmd: 'stop' });
  view.unmount();
  await tick(3000);
  expect(view.onClose).not.toHaveBeenCalled();
});

test('the aspect button follows the shape of the window and stays while an aspect is chosen', async () => {
  const resize = (width: number, height: number) => act(() => { window.innerWidth = width; window.innerHeight = height; window.dispatchEvent(new Event('resize')); });
  const button = () => screen.queryByRole('button', { name: /^Aspect:/ });
  window.innerWidth = 1280; window.innerHeight = 960;
  const view = setup();
  await tick(200);
  fireEvent.loadedMetadata(view.video());
  expect(button()).not.toBeInTheDocument();
  resize(390, 844);
  expect(button()).toBeInTheDocument();
  resize(390, 0);
  expect(button()).toBeInTheDocument();
  resize(1280, 960);
  expect(button()).not.toBeInTheDocument();
  command({ cmd: 'aspect', value: 'zoom' });
  expect(button()).toBeInTheDocument();
});

test.each([false, true])('the 10 second skip buttons are on every screen size, small screen %s', async (small) => {
  vi.stubGlobal('matchMedia', () => ({ matches: small, addListener: vi.fn(), removeListener: vi.fn() }));
  const view = setup();
  await tick(200);
  const back = screen.getByRole('button', { name: 'Skip Back' });
  const forward = screen.getByRole('button', { name: 'Skip Forward' });
  expect(back.querySelector('svg')).toHaveClass('tabler-icon-player-track-prev');
  expect(forward.querySelector('svg')).toHaveClass('tabler-icon-player-track-next');
  fireEvent.click(forward);
  expect(view.video().currentTime).toBe(10);
  fireEvent.click(back);
  expect(view.video().currentTime).toBe(0);
  vi.unstubAllGlobals();
});

test('the controls show the title of the talk and not its description', async () => {
  const view = setup();
  await tick(200);
  expect(view.container.querySelector('.playerUI__title')).toHaveTextContent('Test talk');
  expect(view.container.querySelector('.playerUI__subtitle')).toBeNull();
  expect(view.container).not.toHaveTextContent('Talk description');
});
