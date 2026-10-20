import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const ENDPOINT = 'https://media.ccc.de/graphql';
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();
type Variables = Record<string, unknown>;
type Merge<T> = (existing: T | undefined, incoming: T) => T;

export async function graphqlRequest<T>(query: string, variables: Variables, signal?: AbortSignal): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }), signal,
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const result = await response.json() as { data?: T; errors?: { message?: string }[] };
  if (!result.data) throw new Error(result.errors?.[0]?.message || 'Invalid response');
  return result.data;
}

function setCache(key: string, data: unknown) {
  cache.set(key, data);
  listeners.get(key)?.forEach((notify) => notify());
}
export function seedQuery(key: string, data: unknown) { cache.set(key, data); }
export function updateQuery<T>(key: string, update: (current: T | undefined) => T) {
  setCache(key, update(cache.get(key) as T | undefined));
}
function fetchQuery<T>(key: string, query: string, variables: Variables, merge?: Merge<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = graphqlRequest<T>(query, variables)
    .then((data) => {
      setCache(key, merge ? merge(cache.get(key) as T | undefined, data) : data);
      return data;
    }).finally(() => { inflight.delete(key); });
  inflight.set(key, promise);
  return promise;
}
export function useQuery<T>(key: string, query: string, variables: Variables,
  { skip = false, revalidate = true, merge }: { skip?: boolean; revalidate?: boolean; merge?: Merge<T> } = {}) {
  const subscribe = useCallback((notify: () => void) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    const subscribers = listeners.get(key)!;
    subscribers.add(notify);
    return () => { subscribers.delete(notify); };
  }, [key]);
  const data = useSyncExternalStore(subscribe, () => cache.get(key) as T | undefined);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (skip || (!revalidate && cache.has(key))) return undefined;
    let active = true;
    setError(null);
    fetchQuery<T>(key, query, variables, merge).catch((err: Error) => { if (active) setError(err); });
    return () => { active = false; };
  }, [key, skip, revalidate]);
  return { data, error };
}
