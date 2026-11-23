import React, { useEffect, useRef, useState } from 'react';
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

export const ProgressBar = React.memo(function ProgressBar({ video, focused, visible = true, onSeek }: { video: HTMLVideoElement | null; focused: boolean; visible?: boolean; onSeek: (seconds: number) => void }) {
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [drag, setDrag] = useState<number | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const [timeMode] = useSetting('osdTimeMode');

  useEffect(() => {
    if (!video) return undefined;
    const update = () => setTime({ current: video.currentTime, duration: video.duration });
    update();
    if (!visible) return undefined;
    EVENTS.forEach((name) => video.addEventListener(name, update));
    return () => EVENTS.forEach((name) => video.removeEventListener(name, update));
  }, [video, visible]);

  useEffect(() => () => stopDrag.current?.(), []);

  const known = Number.isFinite(time.duration) && time.duration > 0;
  const shown = drag === null ? time.current : drag * time.duration;
  const percent = known ? Math.min(100, (shown / time.duration) * 100) : 0;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!known || e.button !== 0) return;
    e.preventDefault();
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const { duration } = time;
    const at = (clientX: number) => Math.min(1, Math.max(0, (clientX - left) / width));
    const move = (event: MouseEvent) => setDrag(at(event.clientX));
    const release = (event: MouseEvent) => {
      const seconds = at(event.clientX) * duration;
      setTime((value) => ({ ...value, current: seconds }));
      stopDrag.current?.();
      onSeek(seconds);
    };
    stopDrag.current = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', release);
      stopDrag.current = null;
      setDrag(null);
    };
    setDrag(at(e.clientX));
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', release);
  };

  return (
    <div className={`playerProgress ${known ? '' : 'playerProgress--hidden'}`}>
      <span className="playerProgress__time">{formatClock(shown)}</span>
      <div className="playerProgress__barWrapper" onMouseDown={handleMouseDown}>
        <div className="playerProgress__bar">
          <div className="playerProgress__fill" style={{ width: `${percent}%` }} />
          <div
            className={`playerProgress__thumb ${focused || drag !== null ? 'playerProgress__thumb--focused' : ''}`}
            style={{ transform: `translateX(${percent}%)` }}
          />
        </div>
      </div>
      <span className="playerProgress__time">{known && timeMode === 'remaining' ? `-${formatClock(time.duration - shown)}` : formatClock(time.duration)}</span>
    </div>
  );
});
