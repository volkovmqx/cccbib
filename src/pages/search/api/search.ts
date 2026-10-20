import type { Talk } from '@/entities/talk';
import { SEARCH_LECTURES, fromGraphql, fromRest, isTalk } from '@/entities/talk';
import { API_BASE, graphqlRequest } from '@/shared/api';

const MAX_CACHED = 40;
const cache = new Map<string, Talk[]>();

export const normalizeQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ');

export const getCachedSearch = (query: string) => cache.get(normalizeQuery(query));

function remember(key: string, results: Talk[]) {
  cache.delete(key);
  cache.set(key, results);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}
async function searchRest(query: string, signal?: AbortSignal): Promise<Talk[]> {
  const response = await fetch(`${API_BASE}/events/search?q=${encodeURIComponent(query)}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search failed: ${response.statusText} (${response.status})`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('events' in data) || !Array.isArray(data.events)) {
    throw new Error('Invalid API response format');
  }
  try {
    const results: Talk[] = data.events.map(fromRest);
    if (!results.every(isTalk)) throw new Error('Invalid API response format');
    return results;
  } catch { throw new Error('Invalid API response format'); }
}

export async function searchLectures(query: string, signal?: AbortSignal): Promise<Talk[]> {
  const key = normalizeQuery(query);
  const cached = cache.get(key);
  if (cached) return cached;

  let results: Talk[];
  try {
    const data = await graphqlRequest<unknown>(SEARCH_LECTURES, { q: query.trim() }, signal);
    if (!data || typeof data !== 'object') throw new Error('Invalid API response format');
    const lectures = 'lectureSearch' in data ? data.lectureSearch : undefined;
    if (lectures != null && !Array.isArray(lectures)) throw new Error('Invalid API response format');
    results = (lectures || []).map(fromGraphql);
    if (!results.every(isTalk)) throw new Error('Invalid API response format');
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    results = await searchRest(query.trim(), signal);
  }
  remember(key, results);
  return results;
}
