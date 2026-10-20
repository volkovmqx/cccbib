import type { Talk } from '@/entities/talk';
import { useRef, useEffect, useCallback } from 'react';
import { savePlaybackHistoryItem } from '@/features/playback-history';

const SAVE_INTERVAL_MS = 10000;

export function usePlaybackPosition({
  event,
  conferenceTitle,
  videoElementRef,
  isInWatchlist,
  removeFromWatchlist,
  playing,
}: { event: Talk; conferenceTitle?: string; videoElementRef: React.RefObject<HTMLVideoElement | null>; isInWatchlist: boolean; removeFromWatchlist: (guid: string) => boolean; playing: boolean }) {
  const eventGuid = event.guid;

  const saveCurrentPosition = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement?.currentTime || !eventGuid) return false;

    const duration = videoElement.duration || event.duration;
    if (duration - videoElement.currentTime <= 300 && isInWatchlist) {
      removeFromWatchlist(eventGuid);
    }

    return savePlaybackHistoryItem({
      event,
      conferenceTitle,
      positionSeconds: videoElement.currentTime,
      durationSeconds: duration,
    });
  }, [conferenceTitle, event, eventGuid, isInWatchlist, removeFromWatchlist, videoElementRef]);

  useEffect(() => {
    if (!playing) return undefined;

    const interval = setInterval(() => {
      const videoElement = videoElementRef.current;
      if (videoElement && !videoElement.paused && !videoElement.ended) {
        saveCurrentPosition();
      }
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playing, saveCurrentPosition, videoElementRef]);

  const saveCurrentPositionRef = useRef(saveCurrentPosition);
  useEffect(() => {
    saveCurrentPositionRef.current = saveCurrentPosition;
  }, [saveCurrentPosition]);
  useEffect(() => () => { saveCurrentPositionRef.current(); }, [eventGuid]);

  return { saveCurrentPosition };
}
