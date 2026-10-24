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

export function useIdle(idleMs: number) {
  const [idle, setIdle] = useState(() => !document.hasFocus());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), idleMs);
    };
    const sleep = () => {
      clearTimeout(timer);
      setIdle(true);
    };
    const onVisibility = () => (document.hidden ? sleep() : wake());
    if (document.hasFocus()) wake();
    else sleep();
    window.addEventListener('keydown', wake, true);
    window.addEventListener('mousemove', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('blur', sleep);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', wake, true);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('blur', sleep);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [idleMs]);
  return idle;
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
