const fs = require('node:fs');
const path = require('node:path');

const recording = { url: 'https://static.media.ccc.de/fixture.webm', mimeType: 'video/webm', language: 'deu', width: 160, height: 120, size: 1 };
const subtitles = [{ url: 'https://static.media.ccc.de/fixture.vtt', mimeType: 'text/vtt', language: 'eng' }];
const talk = {
  guid: 'talk', slug: 'talk', title: 'Fixture talk', description: 'Fixture description', duration: 600,
  viewCount: 100, persons: ['Fixture speaker'], conference_title: 'Fixture conference',
  images: { thumbUrl: 'https://static.media.ccc.de/fixture.svg', posterUrl: 'https://static.media.ccc.de/fixture.svg' },
  videos: [recording, { ...recording, language: 'eng' }], subtitles,
};
const conferences = Array.from({ length: 8 }, (_, index) => ({
  id: `conference-${index}`, title: `Fixture conference ${index}`, updatedAt: '2026-01-01',
  lectures: { nodes: [talk, { ...talk, guid: `talk-${index}`, slug: `talk-${index}`, title: `Other talk ${index}` },
    ...Array.from({ length: 6 }, (_, n) => ({ ...talk, guid: `more-${index}-${n}`, slug: `more-${index}-${n}`, title: `More talk ${index}.${n}` }))] },
}));
const restTalk = { ...talk, length: talk.duration, thumb_url: talk.images.thumbUrl, poster_url: talk.images.posterUrl,
  recordings: [...talk.videos, ...subtitles].map(r => ({ recording_url: r.url, mime_type: r.mimeType, language: r.language, width: r.width, height: r.height })) };

const mirrorRow = (base, share) => `<tr><td>1.</td><td>Mirror</td><td><a href="${base}file.webm">${base}</a></td><td>DE</td><td>EU</td><td>1 Km</td><td>${share}</td></tr>`;
const mirrorList = `<h3>Mirrors</h3><table><tbody>${mirrorRow('https://ffmuc.media.ccc.de/', '60%')}${mirrorRow('https://berlin-ak.media.ccc.de/', '30%')}${mirrorRow('https://ftp.fau.de/cdn.media.ccc.de/', '10%')}</tbody></table><h3>Excluded Mirrors</h3><table></table>`;

function fixture(url, postData = '', method = 'GET') {
  const parsed = new URL(url);
  if (parsed.hostname === 'cdn.media.ccc.de' && parsed.search === '?mirrorlist') return { contentType: 'text/html', body: mirrorList };
  if (!['media.ccc.de', 'api.media.ccc.de', 'static.media.ccc.de'].includes(parsed.hostname)) return null;
  if (method === 'OPTIONS') return { status: 204, contentType: 'text/plain', body: '' };
  if (parsed.pathname.endsWith('/fixture.webm')) return { contentType: 'video/webm', body: fs.readFileSync(path.join(__dirname, 'fixture.webm')) };
  if (parsed.pathname.endsWith('/fixture.vtt')) return { contentType: 'text/vtt', body: 'WEBVTT\n\n00:00.000 --> 00:10.000\nFixture subtitle\n' };
  if (parsed.pathname.endsWith('/fixture.svg')) return { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="blue"/></svg>' };
  if (!['media.ccc.de', 'api.media.ccc.de'].includes(parsed.hostname)) return null;
  let body;
  if (parsed.pathname === '/graphql') {
    const { query, variables = {} } = JSON.parse(postData);
    if (query.includes('lectureSearch')) body = { data: { lectureSearch: [{ ...talk, conference: { title: talk.conference_title } }] } };
    else if (query.includes('lectureSubtitles')) body = { data: { lecture: { guid: talk.guid, subtitles } } };
    else if (query.includes('conferencesRecent')) body = { data: { conferencesRecent: conferences.slice(variables.offset || 0, (variables.offset || 0) + 6) } };
    else body = { data: { conference: conferences[0] } };
  } else if (parsed.pathname === '/public/conferences') body = { conferences: conferences.map(c => ({ title: c.title, acronym: c.id, updated_at: c.updatedAt })) };
  else if (parsed.pathname.startsWith('/public/events/')) body = { ...restTalk, guid: parsed.pathname.split('/').pop() };
  else return null;
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

module.exports = { fixture, talk };
