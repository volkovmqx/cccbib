let reader = null;

export function setNowPlayingReader(read) {
  reader = read;
}

export function readNowPlaying() {
  return reader ? reader() : null;
}
