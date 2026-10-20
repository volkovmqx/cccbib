import { savePlaybackHistoryItem, removePlaybackHistoryItem } from './playbackHistory';

export const MIN_SECONDS = 10;

export function progressSeconds(talk, { position, percent }) {
  const duration = Number(talk.duration);
  if (!duration) return null;
  let seconds = null;
  if (Number.isFinite(position)) seconds = position;
  else if (Number.isFinite(percent)) seconds = (duration * percent) / 100;
  return seconds === null ? null : Math.max(0, Math.min(duration, seconds));
}

export function saveTalkProgress(talk, seconds) {
  if (seconds < MIN_SECONDS) {
    removePlaybackHistoryItem(talk.guid);
    return 'cleared';
  }
  savePlaybackHistoryItem({ event: talk, conferenceTitle: talk.conference_title, positionSeconds: seconds, durationSeconds: talk.duration });
  return 'saved';
}
