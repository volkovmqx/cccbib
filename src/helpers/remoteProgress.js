import { savePlaybackHistoryItem, removePlaybackHistoryItem } from './playbackHistory';
import { removeFromWatchlistStore } from './watchlist';

export const MIN_SECONDS = 10;
const WATCHLIST_REMOVE_SECONDS = 300;

export function progressSeconds(talk, { position, percent }) {
  const duration = Number(talk.duration);
  if (!duration) return null;
  let seconds = null;
  if (Number.isFinite(position)) seconds = position;
  else if (Number.isFinite(percent)) seconds = (duration * percent) / 100;
  return seconds === null ? null : Math.max(0, Math.min(duration, seconds));
}

// Same rules as watching: under 10 seconds clears the progress, within the last 5 minutes leaves the watchlist
export function saveTalkProgress(talk, seconds) {
  if (seconds < MIN_SECONDS) {
    removePlaybackHistoryItem(talk.guid);
    return 'cleared';
  }
  savePlaybackHistoryItem({ event: talk, conferenceTitle: talk.conference_title, positionSeconds: seconds, durationSeconds: talk.duration });
  if (talk.duration - seconds <= WATCHLIST_REMOVE_SECONDS) removeFromWatchlistStore(talk.guid);
  return 'saved';
}
