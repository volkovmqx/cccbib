import { useEffect, useRef, useCallback } from 'react';

const LANGUAGE_KEYWORDS = [
  'german', 'english', 'french', 'spanish', 'italian', 'portuguese',
  'russian', 'japanese', 'chinese', 'arabic', 'polish', 'dutch',
  'czech', 'finnish', 'swiss', 'multi-audio', 'auto ('
];
const SUBTITLE_KEYWORDS = ['subtitle', 'subtitles'];
const PLAY_PAUSE_KEYWORDS = ['play', 'pause'];
const REWIND_KEYWORDS = ['back', 'rewind', 'backward'];
const FORWARD_KEYWORDS = ['forward', 'skip'];
const MUTE_KEYWORDS = ['mute', 'volume', 'unmute'];
const WATCHLIST_KEYWORDS = ['watchlist'];

const findButtonByContent = (buttons, keywords) => {
  for (let i = 0; i < buttons.length; i++) {
    const text = (buttons[i].textContent || '').toLowerCase();
    const ariaLabel = (buttons[i].getAttribute('aria-label') || '').toLowerCase();
    const combined = text + ' ' + ariaLabel;
    if (keywords.some(kw => combined.includes(kw))) {
      return i;
    }
  }
  return -1;
};

const getControlButtons = () =>
  document.querySelectorAll('.tv-player button:not([data-testid="progress-bar-button"])');

const updateButtonFocus = (buttons, newIndex) => {
  buttons.forEach(btn => btn.classList.remove('focused'));
  if (buttons[newIndex]) buttons[newIndex].classList.add('focused');
};

const focusButtonByKeywords = (keywords, fallbackIndex = 0) => {
  const buttons = getControlButtons();
  buttons.forEach(btn => btn.classList.remove('focused'));

  const foundIndex = findButtonByContent(buttons, keywords);
  const targetIndex = foundIndex >= 0 ? foundIndex : fallbackIndex;

  if (buttons[targetIndex]) {
    buttons[targetIndex].classList.add('focused');
  }
  return targetIndex;
};

export function usePlayerKeyboard({
  onClose, showControls, hideControls,
  showLanguageSelector, setShowLanguageSelector,
  showSubtitleSelector, setShowSubtitleSelector,
  selectedLanguageIndex, setSelectedLanguageIndex,
  selectedSubtitleIndex, setSelectedSubtitleIndex,
  availableLanguages, subtitleOptions,
  hasMultipleLanguages, hasSubtitles,
  handleLanguagePress, handleSubtitlePress,
  toggleWatchlist, setLanguage, setSubtitleLanguage,
  playing, setPlaying, setIsMuted,
  videoElementRef, controlsVisibleRef, controlsFocusAreaRef,
  focusedButtonIndexRef, lastActivityRef,
  setControlsFocusArea, setFocusedButtonIndex,
}) {
  const showLanguageSelectorRef = useRef(showLanguageSelector);
  const showSubtitleSelectorRef = useRef(showSubtitleSelector);

  useEffect(() => {
    showLanguageSelectorRef.current = showLanguageSelector;
    showSubtitleSelectorRef.current = showSubtitleSelector;
  }, [showLanguageSelector, showSubtitleSelector]);

  const focusPlayPauseButton = useCallback(() => {
    const index = focusButtonByKeywords(PLAY_PAUSE_KEYWORDS, 0);
    setFocusedButtonIndex(index);
    focusedButtonIndexRef.current = index;
    setControlsFocusArea('buttons');
    controlsFocusAreaRef.current = 'buttons';
  }, [setFocusedButtonIndex, focusedButtonIndexRef, setControlsFocusArea, controlsFocusAreaRef]);

  const focusLanguageButton = useCallback(() => {
    setTimeout(() => {
      const index = focusButtonByKeywords(LANGUAGE_KEYWORDS, 0);
      setFocusedButtonIndex(index);
      focusedButtonIndexRef.current = index;
      setControlsFocusArea('buttons');
      controlsFocusAreaRef.current = 'buttons';
    }, 100);
  }, [setFocusedButtonIndex, focusedButtonIndexRef, setControlsFocusArea, controlsFocusAreaRef]);

  const focusSubtitleButton = useCallback(() => {
    setTimeout(() => {
      const index = focusButtonByKeywords(SUBTITLE_KEYWORDS, 0);
      setFocusedButtonIndex(index);
      focusedButtonIndexRef.current = index;
      setControlsFocusArea('buttons');
      controlsFocusAreaRef.current = 'buttons';
    }, 100);
  }, [setFocusedButtonIndex, focusedButtonIndexRef, setControlsFocusArea, controlsFocusAreaRef]);

  const seekVideo = useCallback((seconds) => {
    const videoElement = videoElementRef.current || document.querySelector('video');
    if (videoElement) {
      const newTime = Math.max(0, Math.min(videoElement.duration || 0, videoElement.currentTime + seconds));
      videoElement.currentTime = newTime;
    }
  }, [videoElementRef]);

  const toggleMute = useCallback(() => {
    const videoElement = videoElementRef.current || document.querySelector('video');
    if (videoElement) {
      videoElement.muted = !videoElement.muted;
      setIsMuted(videoElement.muted);
    }
  }, [videoElementRef, setIsMuted]);

  const navigateButtons = useCallback((direction) => {
    const buttons = getControlButtons();
    if (buttons.length === 0) return;

    let currentIndex = -1;
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].classList.contains('focused')) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) {
      currentIndex = findButtonByContent(buttons, PLAY_PAUSE_KEYWORDS);
      if (currentIndex === -1) currentIndex = 0;
    }

    const newIndex = (currentIndex + direction + buttons.length) % buttons.length;
    updateButtonFocus(buttons, newIndex);
    setFocusedButtonIndex(newIndex);
    focusedButtonIndexRef.current = newIndex;
  }, [setFocusedButtonIndex, focusedButtonIndexRef]);

  const activateFocusedButton = useCallback(() => {
    const buttons = getControlButtons();
    const focusedButton = buttons[focusedButtonIndexRef.current];
    if (!focusedButton || focusedButton.disabled) return false;

    const buttonText = (focusedButton.textContent || '').toLowerCase();
    const ariaLabel = (focusedButton.getAttribute('aria-label') || '').toLowerCase();
    const combined = buttonText + ' ' + ariaLabel;

    if (WATCHLIST_KEYWORDS.some(kw => combined.includes(kw))) {
      toggleWatchlist();
      return true;
    }
    if (SUBTITLE_KEYWORDS.some(kw => combined.includes(kw))) {
      handleSubtitlePress();
      return true;
    }
    if (LANGUAGE_KEYWORDS.some(kw => combined.includes(kw))) {
      handleLanguagePress();
      return true;
    }
    if (REWIND_KEYWORDS.some(kw => combined.includes(kw))) {
      seekVideo(-10);
      return true;
    }
    if (FORWARD_KEYWORDS.some(kw => combined.includes(kw))) {
      seekVideo(10);
      return true;
    }
    if (PLAY_PAUSE_KEYWORDS.some(kw => combined.includes(kw))) {
      setPlaying(prev => !prev);
      return true;
    }
    if (MUTE_KEYWORDS.some(kw => combined.includes(kw))) {
      toggleMute();
      return true;
    }

    return false;
  }, [toggleWatchlist, handleSubtitlePress, handleLanguagePress, seekVideo, setPlaying, toggleMute, focusedButtonIndexRef]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isBackKey = e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461;
      const isStopKey = e.keyCode === 413 || e.keyCode === 178;
      const isPlayKey = e.keyCode === 415;
      const isPauseKey = e.keyCode === 19;

      if (isStopKey && !showLanguageSelectorRef.current && !showSubtitleSelectorRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose?.();
        return;
      }

      if (isBackKey && !showLanguageSelectorRef.current && !showSubtitleSelectorRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const inNavigationMode = controlsFocusAreaRef.current !== 'none';
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        const userHasInteracted = timeSinceActivity < 4000;

        // Hide controls if: in navigation mode, OR controls visible and user recently interacted
        if (inNavigationMode || (controlsVisibleRef.current && userHasInteracted)) {
          hideControls();
          return;
        }
        onClose?.();
        return;
      }

      if (!isBackKey && !isStopKey && !isPlayKey) {
        showControls();
      }

      if (!showLanguageSelectorRef.current && !showSubtitleSelectorRef.current) {
        if (isPauseKey) {
          e.preventDefault();
          setPlaying(false);
          showControls();
          setTimeout(() => focusPlayPauseButton(), 50);
          return;
        }

        if (isPlayKey) {
          e.preventDefault();
          hideControls();
          requestAnimationFrame(() => setPlaying(true));
          return;
        }

        if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'MediaPlayPause' || e.keyCode === 179) {
          e.preventDefault();
          setPlaying(prev => !prev);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          showControls();

          setControlsFocusArea('progressbar');
          controlsFocusAreaRef.current = 'progressbar';

          const buttons = getControlButtons();
          buttons.forEach(btn => btn.classList.remove('focused'));
          const progressBar = document.querySelector('.tv-player [data-testid="progress-bar-button"]');
          if (progressBar) progressBar.classList.add('focused');
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          showControls();

          const progressBar = document.querySelector('.tv-player [data-testid="progress-bar-button"]');
          if (progressBar) progressBar.classList.remove('focused');

          focusPlayPauseButton();
          return;
        }

        if (e.key === 'Enter' && controlsFocusAreaRef.current === 'buttons') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showControls();
          activateFocusedButton();
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          showControls();

          if (controlsFocusAreaRef.current !== 'buttons') {
            seekVideo(e.key === 'ArrowLeft' ? -10 : 10);
          } else {
            navigateButtons(e.key === 'ArrowRight' ? 1 : -1);
          }
          return;
        }

        if (e.keyCode === 113) {
          e.preventDefault();
          toggleMute();
          return;
        }

        if ((e.keyCode === 799 || e.keyCode === 460) && hasSubtitles) {
          e.preventDefault();
          handleSubtitlePress();
          showSubtitleSelectorRef.current = true;
          return;
        }

        if ((e.keyCode === 403 || e.keyCode === 457) && hasMultipleLanguages) {
          e.preventDefault();
          handleLanguagePress();
          return;
        }
        return;
      }

      if (showLanguageSelectorRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedLanguageIndex(prev => (prev + 1) % availableLanguages.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedLanguageIndex(prev => (prev - 1 + availableLanguages.length) % availableLanguages.length);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          setLanguage(availableLanguages[selectedLanguageIndex]);
          setShowLanguageSelector(false);
          showLanguageSelectorRef.current = false;
          focusLanguageButton();
          return;
        }
        if (isBackKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setShowLanguageSelector(false);
          showLanguageSelectorRef.current = false;
          focusLanguageButton();
          return;
        }
      }

      if (showSubtitleSelectorRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedSubtitleIndex(prev => (prev + 1) % subtitleOptions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedSubtitleIndex(prev => (prev - 1 + subtitleOptions.length) % subtitleOptions.length);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSubtitleLanguage(subtitleOptions[selectedSubtitleIndex]);
          setShowSubtitleSelector(false);
          showSubtitleSelectorRef.current = false;
          focusSubtitleButton();
          return;
        }
        if (isBackKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setShowSubtitleSelector(false);
          showSubtitleSelectorRef.current = false;
          focusSubtitleButton();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    onClose,
    showControls,
    hideControls,
    hasSubtitles,
    hasMultipleLanguages,
    handleLanguagePress,
    handleSubtitlePress,
    toggleWatchlist,
    availableLanguages,
    subtitleOptions,
    selectedLanguageIndex,
    selectedSubtitleIndex,
    setLanguage,
    setSubtitleLanguage,
    setShowLanguageSelector,
    setShowSubtitleSelector,
    setSelectedLanguageIndex,
    setSelectedSubtitleIndex,
    setPlaying,
    focusPlayPauseButton,
    focusLanguageButton,
    focusSubtitleButton,
    seekVideo,
    toggleMute,
    navigateButtons,
    activateFocusedButton,
    lastActivityRef,
    controlsVisibleRef,
    controlsFocusAreaRef,
    setControlsFocusArea,
  ]);

  return {
    showLanguageSelectorRef,
    showSubtitleSelectorRef,
  };
}

export default usePlayerKeyboard;
