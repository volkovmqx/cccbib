import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getSavedPlaybackPosition,
  savePlaybackHistoryItem,
} from '../../helpers/playbackHistory';

export function usePlaybackPosition({
  event,
  conferenceTitle,
  recording,
  videoElementRef,
  isInWatchlist,
  removeFromWatchlist,
  playing,
}) {
  const eventGuid = event.guid;
  const [startTime, setStartTime] = useState(0);
  const [languageSwitchTime, setLanguageSwitchTime] = useState(null);

  // Load saved position
  useEffect(() => {
    if (recording && eventGuid && !languageSwitchTime) {
      setStartTime(getSavedPlaybackPosition(eventGuid));
    }
  }, [recording?.url, eventGuid, languageSwitchTime]);

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

  // Save position every 10 seconds only during active playback.
  useEffect(() => {
    if (!playing) return undefined;

    const interval = setInterval(() => {
      const videoElement = videoElementRef.current;
      if (videoElement && !videoElement.paused && !videoElement.ended) {
        saveCurrentPosition();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [playing, saveCurrentPosition, videoElementRef]);

  // Save the final position when the player closes or changes event.
  const saveCurrentPositionRef = useRef(saveCurrentPosition);
  useEffect(() => {
    saveCurrentPositionRef.current = saveCurrentPosition;
  }, [saveCurrentPosition]);
  useEffect(() => () => saveCurrentPositionRef.current(), [eventGuid]);

  // Reset the temporary language-switch position after playback starts.
  const handleTimeUpdate = () => {
    if (languageSwitchTime !== null) {
      setTimeout(() => {
        setLanguageSwitchTime(null);
        setStartTime(0);
      }, 1000);
    }
  };

  return {
    startTime,
    setStartTime,
    languageSwitchTime,
    setLanguageSwitchTime,
    handleTimeUpdate,
    saveCurrentPosition,
  };
}
