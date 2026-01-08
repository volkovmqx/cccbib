import { useState, useRef, useEffect } from 'react';

const getStorageKey = (videoGuid) => `playback_position_${videoGuid}`;

export function usePlaybackPosition({ eventGuid, recording, videoElementRef, isInWatchlist }) {
  const [startTime, setStartTime] = useState(0);
  const [languageSwitchTime, setLanguageSwitchTime] = useState(null);
  const saveIntervalRef = useRef(null);
  const lastWatchlistCheckRef = useRef(0);

  // Load saved position
  useEffect(() => {
    if (recording && eventGuid && startTime === 0 && !languageSwitchTime) {
      const savedPosition = localStorage.getItem(getStorageKey(eventGuid));
      if (savedPosition && parseFloat(savedPosition) > 0) {
        setStartTime(parseFloat(savedPosition));
      }
    }
  }, [recording?.url, eventGuid, startTime, languageSwitchTime]);

  // Save position periodically and on unmount
  useEffect(() => {
    const checkAndRemoveFromWatchlist = (currentTime, duration) => {
      if (duration - currentTime <= 300 && isInWatchlist) {
        const stored = localStorage.getItem('watchlist');
        if (stored) {
          let watchlist = JSON.parse(stored);
          const initialLength = watchlist.length;
          watchlist = watchlist.filter(item => item.guid !== eventGuid);
          if (watchlist.length < initialLength) {
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            window.dispatchEvent(new Event('watchlistUpdate'));
          }
        }
      }
    };

    saveIntervalRef.current = setInterval(() => {
      const videoElement = videoElementRef.current;
      if (videoElement?.currentTime && eventGuid) {
        const { currentTime, duration } = videoElement;
        checkAndRemoveFromWatchlist(currentTime, duration);

        if (duration - currentTime > 300) {
          localStorage.setItem(getStorageKey(eventGuid), currentTime.toString());
        } else {
          localStorage.removeItem(getStorageKey(eventGuid));
        }
      }
    }, 300000);

    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);

      const videoElement = videoElementRef.current;
      if (videoElement?.currentTime && eventGuid) {
        const { currentTime, duration } = videoElement;
        checkAndRemoveFromWatchlist(currentTime, duration);

        if (duration - currentTime > 300) {
          localStorage.setItem(getStorageKey(eventGuid), currentTime.toString());
        } else {
          localStorage.removeItem(getStorageKey(eventGuid));
        }
      }
    };
  }, [eventGuid, isInWatchlist, videoElementRef]);

  // Handle time update for watchlist check
  const handleTimeUpdate = () => {
    if (languageSwitchTime !== null) {
      setTimeout(() => {
        setLanguageSwitchTime(null);
        setStartTime(0);
      }, 1000);
    }

    const now = Date.now();
    if (now - lastWatchlistCheckRef.current > 30000) {
      lastWatchlistCheckRef.current = now;
      const videoElement = videoElementRef.current;
      if (videoElement?.currentTime && videoElement?.duration) {
        const timeRemaining = videoElement.duration - videoElement.currentTime;
        if (timeRemaining <= 300 && isInWatchlist) {
          const stored = localStorage.getItem('watchlist');
          if (stored) {
            let watchlist = JSON.parse(stored);
            const initialLength = watchlist.length;
            watchlist = watchlist.filter(item => item.guid !== eventGuid);
            if (watchlist.length < initialLength) {
              localStorage.setItem('watchlist', JSON.stringify(watchlist));
              window.dispatchEvent(new Event('watchlistUpdate'));
            }
          }
        }
      }
    }
  };

  return {
    startTime,
    setStartTime,
    languageSwitchTime,
    setLanguageSwitchTime,
    handleTimeUpdate,
    getStorageKey,
  };
}

export { getStorageKey };
export default usePlaybackPosition;
