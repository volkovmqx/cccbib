import { useState, useEffect, useCallback } from 'react';
import { readWatchlist, addToWatchlistStore, removeFromWatchlistStore } from '../helpers/watchlist';

const WATCHLIST_KEY = 'watchlist';

export function useWatchlist(eventGuid) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  useEffect(() => {
    if (!eventGuid) return;

    try {
      const stored = localStorage.getItem(WATCHLIST_KEY);
      if (stored) {
        const watchlist = JSON.parse(stored);
        setIsInWatchlist(watchlist.some(item => item.guid === eventGuid));
      }
    } catch (err) {
      console.error('Error checking watchlist:', err);
    }
  }, [eventGuid]);

  useEffect(() => {
    const handleUpdate = () => {
      if (!eventGuid) return;
      try {
        const stored = localStorage.getItem(WATCHLIST_KEY);
        if (stored) {
          const watchlist = JSON.parse(stored);
          setIsInWatchlist(watchlist.some(item => item.guid === eventGuid));
        } else {
          setIsInWatchlist(false);
        }
      } catch (err) {
        console.error('Error checking watchlist:', err);
      }
    };

    window.addEventListener('watchlistUpdate', handleUpdate);
    return () => window.removeEventListener('watchlistUpdate', handleUpdate);
  }, [eventGuid]);

  const addToWatchlist = useCallback((eventData) => {
    const added = addToWatchlistStore(eventData);
    if (added) setIsInWatchlist(true);
    return added;
  }, []);

  const removeFromWatchlist = useCallback((guid) => {
    const removed = removeFromWatchlistStore(guid);
    if (removed) setIsInWatchlist(false);
    return removed;
  }, []);

  const toggleWatchlist = useCallback((eventData) => {
    if (isInWatchlist) {
      return removeFromWatchlist(eventData.guid);
    } else {
      return addToWatchlist(eventData);
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  const getWatchlist = useCallback(() => readWatchlist(), []);

  return {
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    getWatchlist,
  };
}

export default useWatchlist;
