import type { NowPlaying } from './types';

let reader: (() => NowPlaying) | null = null;
const listeners = new Set<() => void>();

export function notifyNowPlaying() {
  listeners.forEach((listener) => listener());
}

export function subscribeNowPlaying(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setNowPlayingReader(read: (() => NowPlaying) | null) {
  reader = read;
  notifyNowPlaying();
}

export function readNowPlaying() {
  return reader ? reader() : null;
}
