import type { NowPlaying } from './types';

let reader: (() => NowPlaying) | null = null;

export function setNowPlayingReader(read: (() => NowPlaying) | null) {
  reader = read;
}

export function readNowPlaying() {
  return reader ? reader() : null;
}
