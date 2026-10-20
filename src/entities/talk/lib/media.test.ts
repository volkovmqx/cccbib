import { expect, test, vi } from 'vitest';
import { getVideo, getPreviewVideo, isOddAspect, releaseVideo, formatDuration, formatSeconds } from './media';
import { talk } from '../../../../tests/fixtures';

const recording = talk().videos[0];

test('video selection honors language, container, and resolution priorities', () => {
  const sources = ['video/mp4', 'video/webm'].flatMap(mimeType => ['eng', 'deu-eng', 'deu', ''].map(language => ({ ...recording, mimeType, language })));
  for (let index = 0; index < sources.length - 1; index++) {
    const candidates = sources.slice(index);
    const [best, language] = getVideo(candidates, 'deu');
    expect(best).toBe(candidates[candidates.length - 2]);
    expect(language).toBe('deu');
  }
  expect(getVideo([sources[sources.length - 1]], 'deu')[1]).toBe('');
});

test('video selection resolves ties and handles missing recordings', () => {
  const sources = [recording, { ...recording, width: 1920 }, { ...recording, width: 0 }];
  expect(getVideo(sources, 'deu')[0]?.width).toBe(1920);
  expect(getVideo([...sources].reverse(), 'deu')[0]?.width).toBe(1920);
  expect(getVideo([{ ...recording, width: undefined }], 'deu')[0]).toBeTruthy();
  expect(getVideo([recording, { ...recording, url: '' }, { ...recording, mimeType: 'audio/mp3' }], 'auto')[0]).toBe(recording);
  expect(getVideo([{ ...recording, mimeType: 'video/mp4' }], 'auto')[0]?.mimeType).toBe('video/mp4');
  expect(getVideo([], 'auto')).toEqual([null, null]);
  expect(getVideo([])).toEqual([null, undefined]);
  expect(getVideo([{ ...recording, url: '' }, { ...recording, mimeType: 'audio/mp3' }])).toEqual([null, undefined]);
  expect(getVideo([{ ...recording, language: '' }], 'deu')[0]).toBeTruthy();
});

test('previews use the smallest matching recording and aspect checks require dimensions', () => {
  const small = { ...recording, width: 320 };
  expect(getPreviewVideo([recording, small], 'deu')).toBe(small);
  expect(getPreviewVideo([small, recording], 'deu')).toBe(small);
  expect(getPreviewVideo([], 'deu')).toBeNull();
  const noWidth = { ...recording, width: undefined };
  expect(getPreviewVideo([noWidth], 'deu')).toBe(noWidth);
  expect(isOddAspect([recording], 'deu')).toBe(true);
  expect(isOddAspect([{ ...recording, width: 1920, height: 1080 }], 'deu')).toBe(false);
  for (const sources of [[], [{ ...recording, width: 0 }], [{ ...recording, height: 0 }]]) expect(isOddAspect(sources)).toBe(false);
});

test('releasing a decoder pauses and unloads video, including failed elements', () => {
  const video = document.createElement('video');
  video.src = recording.url;
  releaseVideo(video);
  expect(video.muted).toBe(true);
  expect(video.hasAttribute('src')).toBe(false);
  expect(video.pause).toHaveBeenCalled();
  expect(video.load).toHaveBeenCalled();
  vi.mocked(video.pause).mockImplementation(() => { throw Error('closed'); });
  expect(() => releaseVideo(video)).not.toThrow();
  expect(() => releaseVideo(null)).not.toThrow();
});

test.each([[0, '0:00'], [-1, '0:00'], [NaN, '0:00'], [65, '1:05'], [3601, '1:00:01'], [59.9, '1:00']])('formats duration %s', (seconds, expected) => {
  expect(formatDuration(seconds)).toBe(expected);
  expect(formatSeconds(3661)).toBe('01:01:01');
});
