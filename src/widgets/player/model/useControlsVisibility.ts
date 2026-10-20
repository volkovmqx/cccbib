import type { Focus } from './types';
import { useState, useRef, useCallback, useEffect } from 'react';

const HIDE_DELAY_MS = 4000;

export function useControlsVisibility({ selectorOpen, playing }: { selectorOpen: boolean; playing: boolean }) {
  const [visible, setVisible] = useState(true);
  const [focus, setFocus] = useState<Focus>({ area: 'none', id: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef({ selectorOpen, playing, area: focus.area });
  stateRef.current.selectorOpen = selectorOpen;
  stateRef.current.playing = playing;
  stateRef.current.area = focus.area;

  const scheduleHide = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { selectorOpen: open, playing: isPlaying, area } = stateRef.current;
      if (!open && isPlaying && area === 'none') setVisible(false);
    }, HIDE_DELAY_MS);
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const updateFocus = useCallback((next: Focus) => {
    stateRef.current.area = next.area;
    setFocus(next);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
    updateFocus({ area: 'none', id: null });
  }, [updateFocus]);

  const focusButton = useCallback((id: string) => updateFocus({ area: 'buttons', id }), [updateFocus]);
  const focusProgress = useCallback(() => updateFocus({ area: 'progress', id: null }), [updateFocus]);

  useEffect(() => {
    if (!playing) {
      clearTimeout(timerRef.current);
      setVisible(true);
    } else {
      scheduleHide();
    }
  }, [playing, scheduleHide]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { visible, focus, show, hide, focusButton, focusProgress };
}

