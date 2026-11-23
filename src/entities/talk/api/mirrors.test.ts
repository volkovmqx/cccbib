import { beforeEach, expect, test, vi } from 'vitest';

const CDN = 'https://cdn.media.ccc.de/events/talk.webm';
const row = (base: string, share: string) => `<tr><td style="text-align: right;">1.</td><td>Name</td><td style="text-align: right;"><a href="${base}file.webm">${base}</a></td><td>DE</td><td>EU</td><td>48 Km</td><td style="text-align: center;">${share}</td></tr>`;
const page = (rows: string[], excluded: string[] = []) => `<h3>Mirrors</h3><table><thead><tr><th>Rank</th><th>Mirror Name</th><th>URL</th></tr></thead><tbody>${rows.join('')}</tbody></table><h3>Excluded Mirrors</h3><table>${excluded.join('')}</table>`;
const reply = (body: string, status = 200) => vi.fn().mockResolvedValue(new Response(body, { status }));

const load = async () => {
  vi.resetModules();
  return import('./mirrors');
};
const hosts = (sources: string[]) => sources.slice(0, -1).map((source) => new URL(source).host);

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });

test('the ranking of the CDN mirror list replaces the built in pool and skips unusable mirrors', async () => {
  const fetchMock = reply(page([
    row('https://near.example/', '60%'), row('https://berlin-ak.media.ccc.de/', '9%'), row('http://insecure.example/', '5%'),
    row('https://tiny.example/ccc/', '&lt;1%'), row('https://far.example/', 'n/a'), row('https://second.example/', '30%'),
  ], [row('https://excluded.example/', '50%')]));
  vi.stubGlobal('fetch', fetchMock);
  const { refreshMirrors, videoSources } = await load();
  await refreshMirrors();
  expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/cdn\.media\.ccc\.de\/.+\?mirrorlist$/);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const sources = videoSources(CDN);
  expect(sources).toEqual(['https://near.example/events/talk.webm', 'https://tiny.example/ccc/events/talk.webm', 'https://second.example/events/talk.webm', CDN]);
  expect(JSON.parse(localStorage.getItem('mirror_ranking')!).mirrors).toHaveLength(3);
});

test('a saved ranking is reused for twelve hours before the CDN is asked again', async () => {
  vi.useFakeTimers();
  const fetchMock = reply(page([row('https://fresh.example/', '50%')]));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('mirror_ranking', JSON.stringify({ at: Date.now(), mirrors: [{ base: 'https://saved.example/', weight: 40 }] }));
  const { refreshMirrors, videoSources } = await load();
  await refreshMirrors();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(hosts(videoSources(CDN))).toEqual(['saved.example']);
  vi.setSystemTime(Date.now() + 13 * 60 * 60 * 1000);
  await refreshMirrors();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(hosts(videoSources(CDN))).toEqual(['fresh.example']);
});

test('the built in pool serves playback when the list is unavailable, broken, or empty', async () => {
  const { refreshMirrors, videoSources } = await load();
  const seen = new Set<string>();
  const collect = () => {
    for (let roll = 0; roll < 1; roll += 0.05) {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      hosts(videoSources(CDN)).forEach((host) => seen.add(host));
    }
  };
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
  await refreshMirrors();
  expect(console.error).toHaveBeenCalledWith('Could not load the mirror list', expect.any(Error));
  vi.stubGlobal('fetch', reply('', 500)); await refreshMirrors();
  vi.stubGlobal('fetch', reply(page([]))); await refreshMirrors();
  vi.stubGlobal('fetch', reply('<html></html>')); await refreshMirrors();
  localStorage.setItem('mirror_ranking', '{broken');
  collect();
  expect(localStorage.getItem('mirror_ranking')).toBe('{broken');
  expect(seen).toContain('ftp.fau.de');
  expect(seen).toContain('mirror.selfnet.de');
  expect(seen).not.toContain('berlin-ak.media.ccc.de');
  expect(seen).not.toContain('mirror.netcologne.de');
});

test('the mirror that worked last comes first, also from a ranked pool', async () => {
  vi.stubGlobal('fetch', reply(page([row('https://near.example/', '60%'), row('https://second.example/', '30%')])));
  const { refreshMirrors, rememberMirror, videoSources } = await load();
  await refreshMirrors();
  rememberMirror('https://second.example/events/talk.webm');
  rememberMirror('https://unknown.example/events/talk.webm');
  vi.spyOn(Math, 'random').mockReturnValue(0);
  expect(hosts(videoSources(CDN))).toEqual(['second.example', 'near.example']);
});

test('the mirror that serves a source is described with its share of the ranking', async () => {
  vi.stubGlobal('fetch', reply(page([row('https://near.example/', '75%'), row('https://second.example/', '25%')])));
  const { mirrorInfo, refreshMirrors } = await load();
  expect(mirrorInfo('')).toBeNull();
  expect(mirrorInfo('not a url')).toBeNull();
  expect(mirrorInfo('https://ffmuc.media.ccc.de/events/talk.webm')).toMatchObject({ host: 'ffmuc.media.ccc.de', share: 37, cdn: false });
  await refreshMirrors();
  expect(mirrorInfo('https://second.example/events/talk.webm')).toEqual({ host: 'second.example', share: 25, cdn: false });
  expect(mirrorInfo(CDN)).toEqual({ host: 'cdn.media.ccc.de', share: null, cdn: true });
  expect(mirrorInfo('https://static.media.ccc.de/fixture.webm')).toEqual({ host: 'static.media.ccc.de', share: null, cdn: false });
});

test('non CDN addresses are played as they are', async () => {
  const { videoSources } = await load();
  expect(videoSources('https://static.media.ccc.de/fixture.webm')).toEqual(['https://static.media.ccc.de/fixture.webm']);
});
