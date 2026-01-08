import { useState, useEffect, useCallback } from 'react';

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
    try {
      const stored = localStorage.getItem(WATCHLIST_KEY);
      const watchlist = stored ? JSON.parse(stored) : [];

      if (watchlist.some(item => item.guid === eventData.guid)) {
        return false;
      }

      watchlist.push({
        ...eventData,
        addedAt: Date.now()
      });

      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
      setIsInWatchlist(true);
      window.dispatchEvent(new Event('watchlistUpdate'));
      return true;
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      return false;
    }
  }, []);

  const removeFromWatchlist = useCallback((guid) => {
    try {
      const stored = localStorage.getItem(WATCHLIST_KEY);
      if (!stored) return false;

      let watchlist = JSON.parse(stored);
      const initialLength = watchlist.length;
      watchlist = watchlist.filter(item => item.guid !== guid);

      if (watchlist.length < initialLength) {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
        setIsInWatchlist(false);
        window.dispatchEvent(new Event('watchlistUpdate'));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      return false;
    }
  }, []);

  const toggleWatchlist = useCallback((eventData) => {
    if (isInWatchlist) {
      return removeFromWatchlist(eventData.guid);
    } else {
      return addToWatchlist(eventData);
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  const getWatchlist = useCallback(() => {
    try {
      const stored = localStorage.getItem(WATCHLIST_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Error getting watchlist:', err);
      return [];
    }
  }, []);

  return {
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    getWatchlist,
  };
}

export default useWatchlist;
