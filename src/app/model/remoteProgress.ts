import type { Talk } from '@/entities/talk';
import { savePlaybackHistoryItem, removePlaybackHistoryItem } from '@/features/playback-history';

export const MIN_SECONDS = 10;

export function progressSeconds(talk: Talk, { position, percent }: { position?: number; percent?: number }) {
  const duration = Number(talk.duration);
  if (!duration) return null;
  let seconds: number | null = null;
  if (Number.isFinite(position)) seconds = position!;
  else if (Number.isFinite(percent)) seconds = (duration * percent!) / 100;
  return seconds === null ? null : Math.max(0, Math.min(duration, seconds));
}

export function saveTalkProgress(talk: Talk, seconds: number) {
  if (seconds < MIN_SECONDS) {
    removePlaybackHistoryItem(talk.guid);
    return 'cleared';
  }
  savePlaybackHistoryItem({ event: talk, conferenceTitle: talk.conference_title, positionSeconds: seconds, durationSeconds: talk.duration });
  return 'saved';
}
