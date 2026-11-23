import { useEffect, useState } from 'react';

const matchesNow = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchesNow(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addListener(update);
    return () => list.removeListener(update);
  }, [query]);
  return matches;
}
