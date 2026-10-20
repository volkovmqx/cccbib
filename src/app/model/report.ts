import type { Talk } from '@/entities/talk';
import { readWatchlist } from '@/features/watchlist';
import { readPlaybackHistory } from '@/features/playback-history';
import { readNowPlaying } from '@/widgets/player';

export const talkLink = (event: Talk | null | undefined) => (event && event.slug ? `https://media.ccc.de/v/${event.slug}` : null);

export function buildReport() {
  const history = readPlaybackHistory();
  const positions = new Map(history.map((item) => [item.event.guid, item.positionSeconds]));
  const now = readNowPlaying();
  return {
    v: 1,
    at: new Date().toISOString(),
    state: now ? (now.playing ? 'playing' : 'paused') : 'idle',
    now: now ? {
      title: now.event.title,
      link: talkLink(now.event),
      position: Math.round(now.position || 0),
      duration: Math.round(now.duration || 0),
    } : null,
    watchlist: readWatchlist().map((item) => ({
      title: item.title,
      link: talkLink(item),
      guid: item.guid,
      duration: item.duration,
      position: Math.round(positions.get(item.guid) || 0),
    })),
    progress: history.map((item) => ({
      title: item.event.title,
      link: talkLink(item.event),
      guid: item.event.guid,
      position: Math.round(item.positionSeconds),
      duration: Math.round(item.durationSeconds),
      percent: Math.round((item.positionSeconds / item.durationSeconds) * 100),
      updatedAt: new Date(item.updatedAt).toISOString(),
    })),
  };
}
