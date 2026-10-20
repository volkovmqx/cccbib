import { expect, test } from 'vitest';
import { talk } from '../../../../tests/fixtures';
import { isTalk } from './validation';

test('saved talks accept complete records and missing optional metadata', () => {
  expect(isTalk(talk())).toBe(true);
  expect(isTalk({ guid: 'old', title: 'Older talk', duration: 0, persons: [], images: {}, videos: [] })).toBe(true);
  expect(isTalk(talk({ viewCount: 0, detailsChecked: false }))).toBe(true);
  expect(isTalk(talk({ description: null }))).toBe(true);
  expect(isTalk(talk({ videos: [{ url: 'video', mimeType: 'video/webm', language: 'eng' }],
    subtitles: [{ url: 'subtitles', mimeType: 'text/vtt', language: 'eng' }] }))).toBe(true);
});

test.each([
  null, [], 'talk', {},
  ...[null, 1, ''].map(guid => ({ ...talk(), guid })),
  { ...talk(), title: null },
  ...[null, '600', Infinity].map(duration => ({ ...talk(), duration })),
  { ...talk(), persons: 'Speaker' }, { ...talk(), persons: [null] },
  ...[null, [], { thumbUrl: 1 }, { posterUrl: false }].map(images => ({ ...talk(), images })),
  { ...talk(), videos: {} }, { ...talk(), videos: [null] },
  { ...talk(), videos: [{ ...talk().videos[0], url: null }] },
  { ...talk(), videos: [{ ...talk().videos[0], mimeType: 1 }] },
  { ...talk(), videos: [{ ...talk().videos[0], language: [] }] },
  { ...talk(), videos: [{ ...talk().videos[0], width: '640' }] },
  { ...talk(), videos: [{ ...talk().videos[0], height: Infinity }] },
  { ...talk(), subtitles: {} }, { ...talk(), subtitles: [null] },
  { ...talk(), slug: 1 }, { ...talk(), description: {} }, { ...talk(), conference_title: false },
  { ...talk(), viewCount: '12' }, { ...talk(), detailsChecked: 'yes' },
])('malformed saved talk data is rejected: %j', value => {
  expect(isTalk(value)).toBe(false);
});
