import { useState, useRef, useCallback, useEffect } from 'react';

export function useControlsVisibility({ showLanguageSelector, showSubtitleSelector, playing }) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsFocusArea, setControlsFocusArea] = useState('none');
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0);

  const controlsTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const controlsVisibleRef = useRef(true);
  const controlsFocusAreaRef = useRef('none');
  const focusedButtonIndexRef = useRef(0);
  const playingRef = useRef(playing);

  // Keep playingRef in sync
  useEffect(() => {
    playingRef.current = playing;
    // If video is paused, show controls and keep them visible
    if (!playing) {
      setControlsVisible(true);
      controlsVisibleRef.current = true;
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [playing]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    controlsVisibleRef.current = true;
    lastActivityRef.current = Date.now();

    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      // Don't hide controls if paused, selector is open, or buttons are focused
      if (!showLanguageSelector && !showSubtitleSelector && controlsFocusAreaRef.current === 'none' && playingRef.current) {
        setControlsVisible(false);
        controlsVisibleRef.current = false;
      }
    }, 4000);
  }, [showLanguageSelector, showSubtitleSelector]);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    controlsVisibleRef.current = false;
    setControlsFocusArea('none');
    controlsFocusAreaRef.current = 'none';
    setFocusedButtonIndex(0);
    focusedButtonIndexRef.current = 0;

    const buttons = document.querySelectorAll('.tv-player button');
    buttons.forEach(btn => btn.classList.remove('focused'));

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  return {
    controlsVisible,
    controlsFocusArea,
    setControlsFocusArea,
    focusedButtonIndex,
    setFocusedButtonIndex,
    showControls,
    hideControls,
    controlsVisibleRef,
    controlsFocusAreaRef,
    focusedButtonIndexRef,
    lastActivityRef,
  };
}

export default useControlsVisibility;
