import { useEffect, useRef } from 'react';
import { applyPlayRate } from '@/shared/lib';

const RETRY_MS = 500;
const PENDING_TRIES = 20;
const FAILED_TRIES = 4;

export function usePlaybackSpeed(video: HTMLVideoElement | null, speed: number, onUnsupported: () => void) {
  const changedRef = useRef(false);
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;

  useEffect(() => {
    changedRef.current = false;
  }, [video]);

  useEffect(() => {
    if (!video || (speed === 1 && !changedRef.current)) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const apply = async () => {
      clearTimeout(timer);
      const result = await applyPlayRate(video, speed);
      if (cancelled) return;
      if (result === 'ok') {
        changedRef.current = true;
        return;
      }
      failures += 1;
      if (failures < (result === 'pending' ? PENDING_TRIES : FAILED_TRIES)) timer = setTimeout(apply, RETRY_MS);
      else unsupportedRef.current();
    };
    const restart = () => {
      failures = 0;
      apply();
    };

    restart();
    video.addEventListener('loadedmetadata', restart);
    video.addEventListener('playing', restart);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', restart);
      video.removeEventListener('playing', restart);
    };
  }, [video, speed]);
}
