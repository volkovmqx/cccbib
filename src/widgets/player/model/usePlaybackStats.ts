import type { StatRow, StatsContext, StatsRate } from './playbackStats';
import { useEffect, useRef, useState } from 'react';
import { collectStats, nextRate } from './playbackStats';

const SAMPLE_MS = 1000;

export function usePlaybackStats({ video, context, active }: { video: HTMLVideoElement | null; context: StatsContext; active: boolean }) {
  const [rows, setRows] = useState<StatRow[]>([]);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!active || !video) {
      setRows([]);
      return undefined;
    }
    let rate: StatsRate | null = null;
    const sample = () => {
      const current = contextRef.current;
      rate = nextRate(rate, Date.now(), video, current.speed);
      setRows(collectStats(video, current, rate));
    };
    sample();
    const timer = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [active, video]);

  return rows;
}
