import type { Talk } from '@/entities/talk';
import type { CommandItem, RemoteCommand } from '@/features/remote-control';
import { fetchTalk } from '@/entities/talk';
import { commandItems } from '@/features/remote-control';
import { addToWatchlistStore, removeFromWatchlistStore } from '@/features/watchlist';
import { removePlaybackHistoryItem, replacePlaybackHistory } from '@/features/playback-history';
import { progressSeconds, saveTalkProgress, MIN_SECONDS } from './remoteProgress';
import { readNowPlaying } from '@/widgets/player';

type ListResult = { kind: 'none' | 'added' | 'duplicate' | 'removed' | 'progress' | 'cleared' | 'watchlist' | 'progressList'; title?: string; count?: number };







const PARALLEL = 3;

export const LIST_COMMANDS = ['add', 'remove', 'progress', 'progress-set', 'progress-clear'];

async function loadTalks(items: CommandItem[]) {
  const loaded: { item: CommandItem; talk: Talk }[] = [];
  for (let start = 0; start < items.length; start += PARALLEL) {
    const batch = await Promise.all(items.slice(start, start + PARALLEL).map(async (item) => {
      try {
        return { item, talk: await fetchTalk(item.link) };
      } catch (err) {
        return null;
      }
    }));
    loaded.push(...batch.filter((item): item is { item: CommandItem; talk: Talk } => item !== null));
  }
  return loaded;
}

export async function applyListCommand(command: RemoteCommand, seekPlaying: (seconds: number) => void = () => {}): Promise<ListResult> {
  const items = commandItems(command);
  const loaded = await loadTalks(items);
  if (loaded.length === 0 || (command.cmd === 'progress-set' && loaded.length < items.length)) return { kind: 'none' };
  const single = loaded.length === 1 ? loaded[0].talk : null;
  const count = loaded.length;
  const storeProgress = () => loaded.forEach(({ talk, item }) => {
    const seconds = progressSeconds(talk, item);
    if (seconds !== null) saveTalkProgress(talk, seconds);
  });

  switch (command.cmd) {
    case 'add': {
      let added = 0;
      loaded.forEach(({ talk }) => { if (addToWatchlistStore(talk)) added += 1; });
      storeProgress();
      return single ? { kind: added ? 'added' : 'duplicate', title: single.title } : { kind: 'watchlist', count };
    }
    case 'remove':
      loaded.forEach(({ talk }) => removeFromWatchlistStore(talk.guid));
      return single ? { kind: 'removed', title: single.title } : { kind: 'watchlist', count };
    case 'progress': {
      const playing = readNowPlaying();
      let cleared = false;
      loaded.forEach(({ talk, item }) => {
        const seconds = progressSeconds(talk, item);
        if (seconds === null) return;
        if (playing && talk.guid === playing.event.guid) seekPlaying(seconds);
        else cleared = saveTalkProgress(talk, seconds) === 'cleared';
      });
      return single ? { kind: cleared ? 'cleared' : 'progress', title: single.title } : { kind: 'progressList', count };
    }
    case 'progress-set': {
      const entries = loaded
        .map(({ talk, item }) => ({ talk, seconds: progressSeconds(talk, item) }))
        .filter(({ seconds }) => seconds !== null && seconds >= MIN_SECONDS)
        .map(({ talk, seconds }) => ({ event: talk, conferenceTitle: talk.conference_title, positionSeconds: seconds!, durationSeconds: talk.duration }));
      replacePlaybackHistory(entries);
      return { kind: 'progressList', count };
    }
    default:
      loaded.forEach(({ talk }) => removePlaybackHistoryItem(talk.guid));
      return single ? { kind: 'cleared', title: single.title } : { kind: 'progressList', count };
  }
}
