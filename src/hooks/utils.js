import { useEffect, useMemo, useRef, useState } from 'react';

export function useWindowEvent(type, listener) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const handler = (event) => listenerRef.current(event);
    window.addEventListener(type, handler);
    return () => window.removeEventListener(type, handler);
  }, [type]);
}

export function useIdle(idleMs) {
  const [idle, setIdle] = useState(() => !document.hasFocus());
  useEffect(() => {
    let timer;
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

export function useDebouncedValue(value, wait) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), wait);
    return () => clearTimeout(timer);
  }, [value, wait]);
  return [debounced];
}

export function useListState(initial) {
  const [list, setList] = useState(initial);
  const handlers = useMemo(() => ({
    setState: setList,
    shift: () => setList((current) => current.slice(1)),
    prepend: (...items) => setList((current) => [...items, ...current]),
  }), []);
  return [list, handlers];
}
