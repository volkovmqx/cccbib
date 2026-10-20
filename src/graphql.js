import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const ENDPOINT = 'https://media.ccc.de/graphql';

const cache = new Map();
const inflight = new Map();
const listeners = new Map();

export async function graphqlRequest(query, variables, signal) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const result = await response.json();
  if (!result.data) {
    throw new Error((result.errors && result.errors[0] && result.errors[0].message) || 'Invalid response');
  }
  return result.data;
}

function setCache(key, data) {
  cache.set(key, data);
  const subscribers = listeners.get(key);
  if (subscribers) subscribers.forEach((notify) => notify());
}

export function seedQuery(key, data) {
  cache.set(key, data);
}

export function updateQuery(key, update) {
  setCache(key, update(cache.get(key)));
}

function fetchQuery(key, query, variables, merge) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = graphqlRequest(query, variables)
    .then((data) => {
      setCache(key, merge ? merge(cache.get(key), data) : data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function useQuery(key, query, variables, { skip = false, revalidate = true, merge } = {}) {
  const subscribe = useCallback((notify) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(notify);
    return () => listeners.get(key).delete(notify);
  }, [key]);
  const data = useSyncExternalStore(subscribe, () => cache.get(key));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (skip || (!revalidate && cache.has(key))) return undefined;
    let active = true;
    setError(null);
    fetchQuery(key, query, variables, merge).catch((err) => {
      if (active) setError(err);
    });
    return () => {
      active = false;
    };
  }, [key, skip, revalidate]);

  return { data, error };
}
