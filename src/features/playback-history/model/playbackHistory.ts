import type { PlaybackHistoryItem, ProgressInput } from './types';

export const PLAYBACK_HISTORY_KEY = 'continue_watching';
export const PLAYBACK_HISTORY_EVENT = 'playbackHistoryUpdate';
const PLAYBACK_HISTORY_VERSION = 1;

const MAX_ITEMS = 20;
const MIN_POSITION_SECONDS = 10;
const COMPLETION_RATIO = 0.95;

const getLegacyStorageKey = (eventGuid: string) => `playback_position_${eventGuid}`;

const isFinitePositiveNumber = (value: number) => Number.isFinite(value) && value > 0;

const normalizeItem = (item: ProgressInput & { updatedAt: number }): PlaybackHistoryItem | null => {
  if (!item?.event?.guid) return null;

  const positionSeconds = Number(item.positionSeconds);
  const durationSeconds = Number(item.durationSeconds);
  const updatedAt = Number(item.updatedAt);

  if (!isFinitePositiveNumber(positionSeconds) || !isFinitePositiveNumber(durationSeconds)) {
    return null;
  }

  if (positionSeconds / durationSeconds >= COMPLETION_RATIO) return null;

  return {
    event: item.event,
    conferenceTitle: item.conferenceTitle || item.event.conference_title || '',
    positionSeconds,
    durationSeconds,
    updatedAt: isFinitePositiveNumber(updatedAt) ? updatedAt : 0,
  };
};

export function readPlaybackHistory(): PlaybackHistoryItem[] {
  try {
    const stored = localStorage.getItem(PLAYBACK_HISTORY_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as { version: number; items: PlaybackHistoryItem[] };
    if (parsed?.version !== PLAYBACK_HISTORY_VERSION || !Array.isArray(parsed.items)) {
      return [];
    }

    return parsed.items
      .map(normalizeItem)
      .filter((item): item is PlaybackHistoryItem => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ITEMS);
  } catch (error) {
    console.error('Error loading playback history:', error);
    return [];
  }
}

const notifyPlaybackHistoryUpdate = () => {
  window.dispatchEvent(new Event(PLAYBACK_HISTORY_EVENT));
};

const writePlaybackHistory = (items: PlaybackHistoryItem[]) => {
  try {
    localStorage.setItem(PLAYBACK_HISTORY_KEY, JSON.stringify({
      version: PLAYBACK_HISTORY_VERSION,
      items: items.slice(0, MAX_ITEMS),
    }));
    notifyPlaybackHistoryUpdate();
    return true;
  } catch (error) {
    console.error('Error saving playback history:', error);
    return false;
  }
};

export function savePlaybackHistoryItem({ event, conferenceTitle, positionSeconds, durationSeconds }: ProgressInput) {
  const position = Number(positionSeconds);
  const duration = Number(durationSeconds);

  if (!event?.guid || !isFinitePositiveNumber(position) || !isFinitePositiveNumber(duration)) {
    return false;
  }

  if (position / duration >= COMPLETION_RATIO) {
    return removePlaybackHistoryItem(event.guid);
  }

  const history = readPlaybackHistory();
  const existingItem = history.find(item => item.event.guid === event.guid);
  if (!existingItem && position < MIN_POSITION_SECONDS) return false;

  const item = {
    event,
    conferenceTitle: conferenceTitle || event.conference_title || '',
    positionSeconds: position,
    durationSeconds: duration,
    updatedAt: Date.now(),
  };

  const nextHistory = [
    item,
    ...history.filter(historyItem => historyItem.event.guid !== event.guid),
  ];

  const saved = writePlaybackHistory(nextHistory);
  if (saved) localStorage.removeItem(getLegacyStorageKey(event.guid));
  return saved;
}

export function replacePlaybackHistory(entries: ProgressInput[]) {
  const now = Date.now();
  const items = entries
    .map((entry, index) => normalizeItem({ ...entry, updatedAt: now - index * 1000 }))
    .filter((item): item is PlaybackHistoryItem => item !== null);
  return writePlaybackHistory(items);
}

export function removePlaybackHistoryItem(eventGuid: string) {
  if (!eventGuid) return false;

  const history = readPlaybackHistory();
  const nextHistory = history.filter(item => item.event.guid !== eventGuid);
  localStorage.removeItem(getLegacyStorageKey(eventGuid));

  if (nextHistory.length === history.length) return false;
  return writePlaybackHistory(nextHistory);
}

export function getSavedPlaybackPosition(eventGuid?: string) {
  if (!eventGuid) return 0;

  const historyItem = readPlaybackHistory().find(item => item.event.guid === eventGuid);
  if (historyItem) return historyItem.positionSeconds;

  try {
    const legacyPosition = Number(localStorage.getItem(getLegacyStorageKey(eventGuid)));
    return isFinitePositiveNumber(legacyPosition) ? legacyPosition : 0;
  } catch (error) {
    console.error('Error loading legacy playback position:', error);
    return 0;
  }
}
