import { expect, test, vi } from 'vitest';
import { getSubtitleLanguages, getSubtitleSources, loadSubtitleCues, parseSubtitles, resolveSubtitleUrl } from './subtitles';

test('subtitle sources prefer VTT, remove duplicates, and use CORS hosts', () => {
  const sources = [
    { url: 'https://cdn.media.ccc.de/t.srt', mimeType: 'application/x-subrip', language: 'eng' },
    { url: 'https://cdn.media.ccc.de/t.vtt', mimeType: 'text/vtt', language: 'eng' },
    { url: 'https://cdn.media.ccc.de/t.vtt', mimeType: '', language: 'eng' },
    { url: '', mimeType: '', language: 'deu' },
  ];
  expect(getSubtitleSources(sources, 'eng')).toEqual(['https://static.media.ccc.de/media/t.vtt', 'https://media.ccc.de/srt/t.srt']);
  expect(getSubtitleLanguages(sources)).toEqual(['eng']);
  expect(getSubtitleLanguages(undefined)).toEqual([]);
  expect(getSubtitleSources(undefined, 'eng')).toEqual([]);
  expect(resolveSubtitleUrl('')).toBe('');
  expect(resolveSubtitleUrl('https://cdn.media.ccc.de/t.txt')).toBe('https://cdn.media.ccc.de/t.txt');
  expect(resolveSubtitleUrl('direct')).toBe('direct');
});

test('subtitle parser accepts SRT and VTT and sanitizes cue text', () => {
  const raw = '\ufeffWEBVTT\r\n\r\n1\r\n00:00:01,000 --> 00:00:04,000\r\n<i>Hello</i> <script>bad</script> & text\r\n2\r\n00:00:02.5 --> 00:00:03.0\r\n{\\an8}Second\r\n\r\n00:00:04.0 --> 00:00:04.0\r\nignored\r\n\r\n00:05.0 --> 00:06.12\r\n  Third  \r\n';
  expect(parseSubtitles(raw)).toEqual([
    { start: 1, end: 2.4, text: '<i>Hello</i> bad &amp; text' },
    { start: 2.5, end: 3, text: 'Second' },
    { start: 5, end: 6.12, text: 'Third' },
  ]);
  expect(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:02.000\n\n')).toEqual([]);
  expect(parseSubtitles('not subtitles')).toEqual([]);
  expect(parseSubtitles('00:01.000 --> 00:03.000\nOne\n\n00:01.000 --> 00:02.000\nTwo')).toHaveLength(2);
});

test('subtitle requests share inflight work, cache results, and fall back on errors', async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => new Response(url.includes('missing') ? '' : 'WEBVTT\n\n00:01.000 --> 00:02.000\nText', { status: url.includes('missing') ? 404 : 200 }));
  vi.stubGlobal('fetch', fetch);
  const [first, second] = await Promise.all([loadSubtitleCues(['missing', 'cached']), loadSubtitleCues(['cached'])]);
  expect(first).toEqual(second);
  expect(first[0].text).toBe('Text');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await loadSubtitleCues(['cached'])).toBe(second);
  expect(fetch).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 13; i++) await loadSubtitleCues([`uncached-${i}`]);
  await loadSubtitleCues(['cached']);
  expect(fetch).toHaveBeenCalledTimes(16);
  await expect(loadSubtitleCues([])).rejects.toThrow('No subtitle source');
  fetch.mockResolvedValue(new Response('placeholder'));
  await expect(loadSubtitleCues(['placeholder'])).rejects.toThrow('no cues');
});

test('subtitle requests stop after cancellation', async () => {
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { controller.abort(); return new Response('00:01.000 --> 00:02.000\nText'); }));
  await expect(loadSubtitleCues(['aborted', 'never'], controller.signal)).rejects.toThrow('aborted');
  expect(fetch).toHaveBeenCalledTimes(1);
});
