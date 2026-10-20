import { expect, test, vi } from 'vitest';
import { fromGraphql, fromRest } from './mapping';
import { fetchTalk, talkReference } from './remoteTalk';
import { rememberMirror, videoSources } from './mirrors';
import { json, talk } from '../../../../tests/fixtures';

test('API conversion supplies arrays, languages, and recording types', () => {
  const value = talk();
  expect(fromGraphql({ ...value, conference: { title: 'Conference' } })).toMatchObject({ persons: ['Speaker'], conference_title: 'Conference' });
  expect(fromGraphql({ ...value, persons: undefined, videos: undefined, subtitles: undefined, images: undefined as unknown as TalkImages })).toMatchObject({ persons: [], videos: [], subtitles: [], images: {} });
  const sources = [{ recording_url: 'video', mime_type: 'video/webm' }, { recording_url: 'subtitle', mime_type: 'application/x-subrip' }, { recording_url: 'ignored', mime_type: '' }];
  const rest = fromRest({ guid: 'g', title: 'Title', recordings: sources, original_language: 'deu' });
  expect(rest.videos[0].language).toBe('deu');
  expect(rest.subtitles?.[0].language).toBe('eng');
  expect(fromRest({ guid: 'g', title: 'Title', duration: 20 })).toMatchObject({ duration: 20, persons: [], videos: [], subtitles: [] });
  const source = { ...value.videos[0], language: '' };
  expect(fromGraphql({ ...value, videos: [source], subtitles: [{ ...source, mimeType: 'text/vtt' }], originalLanguage: 'fra' }).videos[0].language).toBe('fra');
  expect(fromGraphql({ ...value, videos: [source] }).videos[0].language).toBe('eng');
});
type TalkImages = ReturnType<typeof talk>['images'];

test('remote talk links accept only the documented host and path', async () => {
  for (const link of ['https://media.ccc.de/v/talk', 'http://media.ccc.de/v/talk', 'media.ccc.de/v/talk?x#y', ' HTTPS://MEDIA.CCC.DE/v/talk/ ']) expect(talkReference(link)).toBe('talk');
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  for (const link of [
    null, '', {}, 123, 'talk', '419d4f7e-7506-4d46-8700-e47e164a8e32',
    'https://example.com/v/talk', 'https://media.ccc.de.evil/v/talk', 'https://media.ccc.de@evil.example/v/talk',
    'https://evilmedia.ccc.de/v/talk', 'https://api.media.ccc.de/v/talk',
    'https://api.media.ccc.de/public/events/talk', 'https://media.ccc.de/public/events/talk',
    'https://media.ccc.de/v/', 'https://media.ccc.de/v/-bad', 'https://media.ccc.de/v/../../etc',
    'javascript:alert(1)', 'file:///etc/passwd',
  ]) {
    expect(talkReference(link)).toBeNull();
    await expect(fetchTalk(link)).rejects.toThrow('Only media.ccc.de');
  }
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValue(json({}, 404));
  await expect(fetchTalk('media.ccc.de/v/missing')).rejects.toThrow('404');
});

test('remote recordings accept only HTTPS URLs on media.ccc.de and its subdomains', async () => {
  const allowed = ['https://media.ccc.de/fixture', 'https://cdn.media.ccc.de/fixture'];
  const urls = [
    ...allowed, undefined, 'https://evil.example/fixture', 'http://cdn.media.ccc.de/fixture',
    'https://media.ccc.de.evil.example/fixture', 'https://evilmedia.ccc.de/fixture',
    'https://media.ccc.de@evil.example/fixture', 'file:///fixture',
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ guid: 'g', title: 'Title', length: 10,
    recordings: urls.flatMap(recording_url => ['video/webm', 'text/vtt'].map(mime_type => ({ recording_url, mime_type }))),
  })));
  const result = await fetchTalk('media.ccc.de/v/talk');
  expect(result.videos.map(video => video.url)).toEqual(allowed);
  expect(result.subtitles?.map(subtitle => subtitle.url)).toEqual(allowed);
});

test('mirror selection preserves direct URLs and remembers a working mirror', () => {
  expect(videoSources('direct')).toEqual(['direct']);
  expect(videoSources('')).toEqual(['']);
  rememberMirror('');
  rememberMirror('https://unknown.example/video');
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
  const cdn = 'https://cdn.media.ccc.de/file.webm';
  const sources = videoSources(cdn);
  expect(sources).toHaveLength(4);
  expect(sources[sources.length - 1]).toBe(cdn);
  rememberMirror('https://ftp.agdsn.de/ccc/file.webm');
  expect(videoSources(cdn)[0]).toBe('https://ftp.agdsn.de/ccc/file.webm');
  vi.mocked(Math.random).mockReturnValue(0);
  expect(new Set(videoSources(cdn)).size).toBe(4);
});
