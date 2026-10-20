import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useSubtitleManagement } from './useSubtitleManagement';
import { loadSubtitleCues } from '@/shared/lib';
import { getSavedSubtitleLanguage, saveSubtitleLanguage } from './subtitleChoice';
import type { SubtitleSource } from '@/entities/talk';

const query = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/shared/api', () => ({ useQuery: () => query }));
vi.mock('@/shared/lib', async importOriginal => ({ ...await importOriginal<typeof import('@/shared/lib')>(), loadSubtitleCues: vi.fn() }));
const sources: SubtitleSource[] = [{ url: 'subtitle.vtt', language: 'eng', mimeType: 'text/vtt' }, { url: 'deu.vtt', language: 'deu', mimeType: 'text/vtt' }];
beforeEach(() => {
  query.data = undefined;
  vi.mocked(loadSubtitleCues).mockResolvedValue([{ start: 1, end: 2, text: 'Subtitle' }]);
  vi.stubGlobal('VTTCue', class { constructor(public startTime: number, public endTime: number, public text: string) {} });
});
function videoWithTrack() {
  const video = document.createElement('video');
  const track = { mode: 'showing', cues: [{ startTime: 0 }] as unknown[], addCue: vi.fn((cue: unknown) => { track.cues.push(cue); }), removeCue: vi.fn(() => { track.cues.shift(); }) };
  Object.defineProperty(video, 'textTracks', { value: [track], configurable: true });
  vi.spyOn(video, 'addTextTrack').mockReturnValue(track as unknown as TextTrack);
  return { video, track };
}

test('subtitle hook uses preferred and saved choices and cleans up text tracks', async () => {
  const { video, track } = videoWithTrack();
  const props = { eventGuid: 'talk', eventSubtitles: sources, videoElement: video as HTMLVideoElement | null, preferredSubtitleLanguage: 'eng' };
  const hook = renderHook(value => useSubtitleManagement(value), { initialProps: props });
  await act(async () => {});
  expect(hook.result.current.subtitleStatus).toBe('ready');
  expect(track.addCue).toHaveBeenCalled(); expect(track.mode).toBe('showing');
  act(() => { hook.result.current.setSubtitleLanguage('deu'); });
  await act(async () => {});
  expect(getSavedSubtitleLanguage('talk')).toBe('deu');
  expect(hook.result.current.subtitleLanguage).toBe('deu');
  act(() => { hook.result.current.setSubtitleLanguage('none'); });
  expect(hook.result.current.subtitleStatus).toBe('idle');
  expect(track.mode).toBe('disabled');
  hook.rerender({ ...props, videoElement: null });
  hook.unmount();
});

test('subtitle hook looks up missing metadata and ignores invalid saved choices', async () => {
  const { video } = videoWithTrack();
  saveSubtitleLanguage('talk', 'invalid');
  const props = { eventGuid: 'talk', eventSubtitles: undefined as SubtitleSource[] | undefined, videoElement: video, preferredSubtitleLanguage: 'eng' };
  const hook = renderHook(value => useSubtitleManagement(value), { initialProps: props });
  expect(hook.result.current.hasSubtitles).toBe(false);
  expect(hook.result.current.subtitleLanguage).toBe('none');
  query.data = { lecture: { subtitles: sources } };
  hook.rerender({ ...props });
  await act(async () => {});
  expect(hook.result.current.availableSubtitles).toEqual(['eng', 'deu']);
  expect(hook.result.current.subtitleLanguage).toBe('eng');
  hook.rerender({ ...props, eventGuid: 'other' });
  await act(async () => {});
  expect(hook.result.current.subtitleLanguage).toBe('eng');
});

test('unusable subtitle languages disappear and late responses do not create tracks', async () => {
  const { video } = videoWithTrack();
  vi.mocked(loadSubtitleCues).mockRejectedValue(Error('404'));
  const hook = renderHook(() => useSubtitleManagement({ eventGuid: 'talk', eventSubtitles: sources, videoElement: video, preferredSubtitleLanguage: 'eng' }));
  await act(async () => {});
  expect(hook.result.current.hasSubtitles).toBe(false);
  expect(hook.result.current.subtitleOptions).toEqual(['none']);
  hook.unmount();
  let resolve!: (cues: { start: number; end: number; text: string }[]) => void;
  vi.mocked(loadSubtitleCues).mockImplementation(() => new Promise(next => { resolve = next; }));
  const late = renderHook(() => useSubtitleManagement({ eventGuid: 'other', eventSubtitles: sources, videoElement: video, preferredSubtitleLanguage: 'eng' }));
  late.unmount();
  await act(async () => { resolve([{ start: 1, end: 2, text: 'Late' }]); });
  expect(video.addTextTrack).not.toHaveBeenCalled();
});

test('subtitle hook works without AbortController', async () => {
  vi.stubGlobal('AbortController', undefined);
  const { video } = videoWithTrack();
  const hook = renderHook(() => useSubtitleManagement({ eventGuid: 'talk', eventSubtitles: sources, videoElement: video, preferredSubtitleLanguage: 'eng' }));
  await act(async () => {});
  expect(hook.result.current.subtitleStatus).toBe('ready');
  hook.unmount();
});
