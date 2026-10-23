import { useEffect, useRef, useState } from 'react';

export function useWindowEvent<K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const handler = (event: WindowEventMap[K]) => listenerRef.current(event);
    window.addEventListener(type, handler);
    return () => window.removeEventListener(type, handler);
  }, [type]);
}

export function useDelayedFlag(active: boolean, delayMs: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    setElapsed(false);
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return active && elapsed;
}
