import React, { useEffect, useState } from 'react';
import { useSetting } from '@/shared/config';

const EVENTS = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked'];

export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export const ProgressBar = React.memo(function ProgressBar({ video, focused, onSeek }: { video: HTMLVideoElement | null; focused: boolean; onSeek: (seconds: number) => void }) {
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [timeMode] = useSetting('osdTimeMode');

  useEffect(() => {
    if (!video) return undefined;
    const update = () => setTime({ current: video.currentTime, duration: video.duration });
    update();
    EVENTS.forEach((name) => video.addEventListener(name, update));
    return () => EVENTS.forEach((name) => video.removeEventListener(name, update));
  }, [video]);

  const known = Number.isFinite(time.duration) && time.duration > 0;
  const percent = known ? Math.min(100, (time.current / time.duration) * 100) : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!known) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - rect.left) / rect.width) * time.duration);
  };

  return (
    <div className={`playerProgress ${known ? '' : 'playerProgress--hidden'}`}>
      <span className="playerProgress__time">{formatClock(time.current)}</span>
      <div className="playerProgress__barWrapper" onClick={handleClick}>
        <div className="playerProgress__bar">
          <div className="playerProgress__fill" style={{ width: `${percent}%` }} />
          <div
            className={`playerProgress__thumb ${focused ? 'playerProgress__thumb--focused' : ''}`}
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>
      <span className="playerProgress__time">{known && timeMode === 'remaining' ? `-${formatClock(time.duration - time.current)}` : formatClock(time.duration)}</span>
    </div>
  );
});
