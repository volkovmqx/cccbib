import { useEffect, useRef } from 'react';
import { usesOutputWindow, applyOutputWindow } from '../../helpers/videoWindow';

const RETRY_MS = 500;
const REFRESH_MS = 3000;
const PENDING_TRIES = 40;
const FAILED_TRIES = 5;

export function useOutputWindow(video, mode) {
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = false;
  }, [video]);

  useEffect(() => {
    if (!video || !usesOutputWindow()) return undefined;
    if (mode === 'auto' && !activeRef.current) return undefined;

    let cancelled = false;
    let retryTimer = null;
    let refreshTimer = null;
    let failures = 0;

    const apply = async () => {
      if (cancelled) return;
      const result = await applyOutputWindow(video, mode);
      if (cancelled || result === 'wait') return;
      if (result === 'ok') {
        failures = 0;
        activeRef.current = mode !== 'auto';
        if (mode !== 'auto' && !refreshTimer) refreshTimer = setInterval(apply, REFRESH_MS);
        return;
      }
      failures += 1;
      if (failures < (result === 'pending' ? PENDING_TRIES : FAILED_TRIES)) retryTimer = setTimeout(apply, RETRY_MS);
    };

    apply();
    video.addEventListener('loadedmetadata', apply);
    video.addEventListener('resize', apply);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(refreshTimer);
      video.removeEventListener('loadedmetadata', apply);
      video.removeEventListener('resize', apply);
    };
  }, [video, mode]);
}
