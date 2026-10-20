import type { Talk } from '@/entities/talk';
import { useState, useEffect, useCallback } from 'react';
import { readWatchlist, addToWatchlistStore, removeFromWatchlistStore } from './watchlist';

export function useWatchlist(eventGuid?: string) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setIsInWatchlist(Boolean(eventGuid) && readWatchlist().some(item => item?.guid === eventGuid));
    };

    handleUpdate();
    window.addEventListener('watchlistUpdate', handleUpdate);
    return () => window.removeEventListener('watchlistUpdate', handleUpdate);
  }, [eventGuid]);

  const addToWatchlist = useCallback((eventData: Talk) => {
    const added = addToWatchlistStore(eventData);
    if (added) setIsInWatchlist(true);
    return added;
  }, []);

  const removeFromWatchlist = useCallback((guid: string) => {
    const removed = removeFromWatchlistStore(guid);
    if (removed) setIsInWatchlist(false);
    return removed;
  }, []);

  const toggleWatchlist = useCallback((eventData: Talk) => {
    if (isInWatchlist) {
      return removeFromWatchlist(eventData.guid);
    } else {
      return addToWatchlist(eventData);
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  return {
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
  };
}

