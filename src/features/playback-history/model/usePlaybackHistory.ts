import { useEffect, useState } from 'react';
import {
  PLAYBACK_HISTORY_EVENT,
  PLAYBACK_HISTORY_KEY,
  readPlaybackHistory,
} from './playbackHistory';

export function usePlaybackHistory() {
  const [history, setHistory] = useState(() => readPlaybackHistory());

  useEffect(() => {
    const reloadHistory = () => setHistory(readPlaybackHistory());
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === PLAYBACK_HISTORY_KEY) reloadHistory();
    };

    window.addEventListener(PLAYBACK_HISTORY_EVENT, reloadHistory);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(PLAYBACK_HISTORY_EVENT, reloadHistory);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return history;
}
