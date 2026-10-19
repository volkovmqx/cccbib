import { graphqlRequest } from './graphql';
import { SEARCH_LECTURES } from './data';
import { API_BASE } from './api';

const MAX_CACHED = 40;
const cache = new Map();

export const normalizeQuery = (query) => query.trim().toLowerCase().replace(/\s+/g, ' ');

export const getCachedSearch = (query) => cache.get(normalizeQuery(query));

function remember(key, results) {
  cache.delete(key);
  cache.set(key, results);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value);
}

const fromGraphql = (lecture) => ({
  guid: lecture.guid,
  slug: lecture.slug,
  title: lecture.title,
  description: lecture.description,
  duration: lecture.duration,
  viewCount: lecture.viewCount,
  persons: lecture.persons || [],
  conference_title: lecture.conference && lecture.conference.title,
  images: lecture.images || {},
  videos: (lecture.videos || []).map((video) => ({ ...video, language: video.language || lecture.originalLanguage || 'eng' })),
  subtitles: (lecture.subtitles || []).map((subtitle) => ({ ...subtitle, language: subtitle.language || 'eng' })),
});

export const fromRest = (event) => ({
  guid: event.guid,
  slug: event.slug,
  title: event.title,
  description: event.description,
  duration: event.length || event.duration,
  viewCount: event.view_count,
  persons: event.persons || [],
  conference_title: event.conference_title,
  images: { thumbUrl: event.thumb_url, posterUrl: event.poster_url },
  videos: (event.recordings || [])
    .filter((r) => r.mime_type && r.mime_type.includes('video'))
    .map((r) => ({ url: r.recording_url, mimeType: r.mime_type, language: r.language || event.original_language || 'eng', width: r.width, height: r.height })),
  subtitles: (event.recordings || [])
    .filter((r) => r.mime_type && /vtt|subrip/i.test(r.mime_type))
    .map((r) => ({ url: r.recording_url, mimeType: r.mime_type, language: r.language || 'eng' })),
});

async function searchRest(query, signal) {
  const response = await fetch(`${API_BASE}/events/search?q=${encodeURIComponent(query)}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search failed: ${response.statusText} (${response.status})`);
  const data = await response.json();
  if (!data || !data.events) throw new Error('Invalid API response format');
  return data.events.map(fromRest);
}

export async function searchLectures(query, signal) {
  const key = normalizeQuery(query);
  const cached = cache.get(key);
  if (cached) return cached;

  let results;
  try {
    const data = await graphqlRequest(SEARCH_LECTURES, { q: query.trim() }, signal);
    results = (data.lectureSearch || []).map(fromGraphql);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    results = await searchRest(query.trim(), signal);
  }
  remember(key, results);
  return results;
}
