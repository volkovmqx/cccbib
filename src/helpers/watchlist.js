const WATCHLIST_KEY = 'watchlist';

export function readWatchlist() {
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Error reading watchlist:', err);
    return [];
  }
}

export function writeWatchlist(watchlist) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  window.dispatchEvent(new Event('watchlistUpdate'));
}

export function addToWatchlistStore(eventData) {
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

export function removeFromWatchlistStore(guid) {
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
