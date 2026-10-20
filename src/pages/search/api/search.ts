import type { Talk, GraphqlTalk } from '@/entities/talk';
import { graphqlRequest } from '@/shared/api';
import { SEARCH_LECTURES } from '@/entities/talk';
import { API_BASE } from '@/shared/api';
import { fromGraphql, fromRest } from '@/entities/talk';

const MAX_CACHED = 40;
const cache = new Map<string, Talk[]>();

export const normalizeQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ');

export const getCachedSearch = (query: string) => cache.get(normalizeQuery(query));

function remember(key: string, results: Talk[]) {
  cache.delete(key);
  cache.set(key, results);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}



async function searchRest(query: string, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE}/events/search?q=${encodeURIComponent(query)}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search failed: ${response.statusText} (${response.status})`);
  const data = await response.json();
  if (!data || !data.events) throw new Error('Invalid API response format');
  return data.events.map(fromRest);
}

export async function searchLectures(query: string, signal?: AbortSignal) {
  const key = normalizeQuery(query);
  const cached = cache.get(key);
  if (cached) return cached;

  let results;
  try {
    const data = await graphqlRequest<{ lectureSearch?: GraphqlTalk[] }>(SEARCH_LECTURES, { q: query.trim() }, signal);
    results = (data.lectureSearch || []).map(fromGraphql);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    results = await searchRest(query.trim(), signal);
  }
  remember(key, results);
  return results;
}
