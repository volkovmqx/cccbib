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
  for (const link of [null, '', {}, 'talk', 'https://example.com/v/talk', 'https://media.ccc.de.evil/v/talk', 'https://media.ccc.de/v/', 'https://media.ccc.de/v/-bad',
    'https://media.ccc.de@evil.example/v/talk', 'https://evilmedia.ccc.de/v/talk', 'https://api.media.ccc.de/v/talk', 'https://api.media.ccc.de/public/events/talk', 'https://media.ccc.de/public/events/talk',
    '419d4f7e-7506-4d46-8700-e47e164a8e32', 'javascript:alert(1)', 'https://media.ccc.de/v/../../etc', 'file:///etc/passwd']) {
    expect(talkReference(link)).toBeNull();
    await expect(fetchTalk(link)).rejects.toThrow('Only media.ccc.de');
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ guid: 'g', title: 'Title', length: 10, recordings: [
    { mime_type: 'video/webm', recording_url: 'https://static.media.ccc.de/g', language: 'eng' },
    { mime_type: 'video/webm', recording_url: 'https://evil.example/g' },
    { mime_type: 'text/vtt', recording_url: 'https://static.media.ccc.de/g.vtt' },
    { mime_type: 'text/vtt' },
  ] })));
  const result = await fetchTalk('media.ccc.de/v/talk');
  expect(result.videos).toHaveLength(1);
  expect(result.subtitles).toHaveLength(1);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 404)));
  await expect(fetchTalk('media.ccc.de/v/missing')).rejects.toThrow('404');
});

test('recording and subtitle urls outside https media.ccc.de are dropped', async () => {
  const recordings = [
    { recording_url: 'https://cdn.media.ccc.de/a.webm', mime_type: 'video/webm' },
    { recording_url: 'http://cdn.media.ccc.de/c.webm', mime_type: 'video/webm' },
    { recording_url: 'https://media.ccc.de.evil.example/d.webm', mime_type: 'video/webm' },
    { recording_url: 'https://evilmedia.ccc.de/e.webm', mime_type: 'video/webm' },
    { recording_url: 'https://static.media.ccc.de/x.vtt', mime_type: 'text/vtt' },
    { recording_url: 'https://evil.example/x.vtt', mime_type: 'text/vtt' },
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ guid: 'g', title: 'Title', length: 60, recordings })));
  const result = await fetchTalk('media.ccc.de/v/talk');
  expect(result.videos.map(video => video.url)).toEqual(['https://cdn.media.ccc.de/a.webm']);
  expect(result.subtitles?.map(subtitle => subtitle.url)).toEqual(['https://static.media.ccc.de/x.vtt']);
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
