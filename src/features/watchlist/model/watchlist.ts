import type { Talk } from '@/entities/talk';
import { isTalk } from '@/entities/talk';

const WATCHLIST_KEY = 'watchlist';

export function readWatchlist(): (Talk & { addedAt?: number })[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    const watchlist: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(watchlist) ? watchlist.filter((item: unknown): item is Talk & { addedAt?: number } =>
      isTalk(item) && (!('addedAt' in item) || (typeof item.addedAt === 'number' && Number.isFinite(item.addedAt)))) : [];
  } catch (err) {
    console.error('Error reading watchlist:', err);
    return [];
  }
}

export function writeWatchlist(watchlist: Talk[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  window.dispatchEvent(new Event('watchlistUpdate'));
}

export function addToWatchlistStore(eventData: Talk) {
  try {
    const watchlist = readWatchlist();
    if (watchlist.some((item) => item.guid === eventData.guid)) return false;
    watchlist.push({ ...eventData, addedAt: Date.now() });
    writeWatchlist(watchlist);
    return true;
  } catch (err) {
    console.error('Error adding to watchlist:', err);
    return false;
  }
}

export function removeFromWatchlistStore(guid: string) {
  try {
    const watchlist = readWatchlist();
    const remaining = watchlist.filter((item) => item.guid !== guid);
    if (remaining.length === watchlist.length) return false;
    writeWatchlist(remaining);
    return true;
  } catch (err) {
    console.error('Error removing from watchlist:', err);
    return false;
  }
}
