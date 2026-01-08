import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TVPlayer } from "react-tv-player";
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe";
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons/faClockRotateLeft";
import { faBookmark as faBookmarkSolid } from "@fortawesome/free-solid-svg-icons/faBookmark";
import { faClosedCaptioning } from "@fortawesome/free-solid-svg-icons/faClosedCaptioning";
import { faVolumeXmark } from "@fortawesome/free-solid-svg-icons/faVolumeXmark";
import { faVolumeHigh } from "@fortawesome/free-solid-svg-icons/faVolumeHigh";
import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons/faBookmark";
import { useLocalStorage } from "@mantine/hooks";
import { getVideo } from '../../helpers/helpers';
import { LANGUAGE_NAMES, LANG_CODE_MAP } from '../../constants';
import { useWatchlist } from '../../hooks/useWatchlist';
import { usePlayerKeyboard } from './usePlayerKeyboard';
import { useControlsVisibility } from './useControlsVisibility';
import { usePlaybackPosition, getStorageKey } from './usePlaybackPosition';
import { useSubtitleManagement } from './useSubtitleManagement';
import { SelectorModal } from './SelectorModal';

export const Player = React.memo(function Player({ event, conferenceTitle, onClose }) {
  const [preferredAudioLanguage] = useLocalStorage({ key: 'language', defaultValue: 'deu' });
  const [preferredSubtitleLanguage] = useLocalStorage({ key: 'subtitleLanguage', defaultValue: 'none' });
  const [subtitleSize] = useLocalStorage({ key: 'subtitleSize', defaultValue: 'medium' });
  const [subtitleStyle] = useLocalStorage({ key: 'subtitleStyle', defaultValue: 'green' });

  const [language, setLanguage] = useState(preferredAudioLanguage);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showSubtitleSelector, setShowSubtitleSelector] = useState(false);
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [recording, setRecording] = useState(null);
  const [recordingLanguage, setRecordingLanguage] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const playerRef = useRef(null);
  const videoElementRef = useRef(null);

  const { isInWatchlist, toggleWatchlist: toggleWatchlistBase } = useWatchlist(event.guid);

  const toggleWatchlist = useCallback(() => {
    toggleWatchlistBase({
      guid: event.guid,
      title: event.title,
      description: event.description,
      duration: event.duration,
      persons: event.persons,
      viewCount: event.viewCount,
      conference_title: conferenceTitle,
      images: event.images,
      videos: event.videos,
      subtitles: event.subtitles,
    });
  }, [toggleWatchlistBase, event, conferenceTitle]);

  // Controls visibility hook
  const {
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
  } = useControlsVisibility({ showLanguageSelector, showSubtitleSelector });

  // Playback position hook
  const {
    startTime,
    setStartTime,
    languageSwitchTime,
    setLanguageSwitchTime,
    handleTimeUpdate,
  } = usePlaybackPosition({
    eventGuid: event.guid,
    recording,
    videoElementRef,
    isInWatchlist,
  });

  // Subtitle management hook
  const {
    subtitleLanguage,
    setSubtitleLanguage,
    activeSubtitle,
    availableSubtitles,
    subtitleOptions,
    hasSubtitles,
  } = useSubtitleManagement({
    eventGuid: event.guid,
    eventSubtitles: event.subtitles,
    videoElementRef,
    preferredSubtitleLanguage,
  });

  // Available languages
  const availableLanguages = useMemo(() => [...new Set(
    event.videos
      .filter(v => v.mimeType === "video/webm" && v.url && v.language)
      .flatMap(v => v.language.split('-'))
  )], [event.videos]);

  const hasMultipleLanguages = availableLanguages.length > 1;
  const isMultiLanguage = recordingLanguage && recordingLanguage.includes('-');

  // Update recording when language changes
  useEffect(() => {
    const [rec, , recLang] = getVideo(event.videos, language);
    setRecording(rec);
    setRecordingLanguage(recLang);
  }, [language, event.videos]);

  // Set subtitle attributes on body
  useEffect(() => {
    document.body.setAttribute('data-subtitle-size', subtitleSize);
    document.body.setAttribute('data-subtitle-style', subtitleStyle);
  }, [subtitleSize, subtitleStyle]);

  // Initialize language based on availability
  useEffect(() => {
    if (availableLanguages.length > 0) {
      if (availableLanguages.includes(preferredAudioLanguage)) {
        setLanguage(preferredAudioLanguage);
      } else {
        setLanguage(availableLanguages[0]);
      }
    }
  }, [event.guid, availableLanguages, preferredAudioLanguage]);

  // Reset video ready state
  useEffect(() => {
    setIsVideoReady(false);
  }, [event.guid, recording?.url]);

  // Update selector indices
  useEffect(() => {
    if (showLanguageSelector) {
      const index = availableLanguages.indexOf(language);
      setSelectedLanguageIndex(index >= 0 ? index : 0);
    }
  }, [showLanguageSelector, language, availableLanguages]);

  useEffect(() => {
    if (showSubtitleSelector) {
      const index = subtitleOptions.indexOf(subtitleLanguage);
      setSelectedSubtitleIndex(index >= 0 ? index : 0);
    }
  }, [showSubtitleSelector, subtitleLanguage, subtitleOptions]);

  // Button handlers
  const handleLanguagePress = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (videoElement?.currentTime && event.guid) {
      localStorage.setItem(getStorageKey(event.guid), videoElement.currentTime.toString());
      setLanguageSwitchTime(videoElement.currentTime);
      setStartTime(videoElement.currentTime);
    }
    setShowLanguageSelector(true);
  }, [event.guid, setLanguageSwitchTime, setStartTime]);

  const handleSubtitlePress = useCallback(() => {
    const idx = subtitleOptions.indexOf(subtitleLanguage);
    setSelectedSubtitleIndex(idx >= 0 ? idx : 0);
    setShowSubtitleSelector(true);
  }, [subtitleOptions, subtitleLanguage]);

  const handleMutePress = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (videoElement) {
      videoElement.muted = !videoElement.muted;
      setIsMuted(videoElement.muted);
    }
  }, []);

  // Keyboard navigation
  usePlayerKeyboard({
    onClose,
    showControls,
    hideControls,
    showLanguageSelector,
    setShowLanguageSelector,
    showSubtitleSelector,
    setShowSubtitleSelector,
    selectedLanguageIndex,
    setSelectedLanguageIndex,
    selectedSubtitleIndex,
    setSelectedSubtitleIndex,
    availableLanguages,
    subtitleOptions,
    hasMultipleLanguages,
    hasSubtitles,
    handleLanguagePress,
    handleSubtitlePress,
    toggleWatchlist,
    setLanguage,
    setSubtitleLanguage,
    playing,
    setPlaying,
    setIsMuted,
    videoElementRef,
    controlsVisibleRef,
    controlsFocusAreaRef,
    focusedButtonIndexRef,
    lastActivityRef,
    setControlsFocusArea,
    setFocusedButtonIndex,
  });

  // Language button label
  const languageButtonLabel = useMemo(() => {
    if (language === 'auto' && recordingLanguage) {
      return recordingLanguage.includes('-')
        ? `Auto (${recordingLanguage.split('-').map(l => LANGUAGE_NAMES[l] || l).join('-')})`
        : `Auto (${LANGUAGE_NAMES[recordingLanguage] || recordingLanguage})`;
    }
    if (isMultiLanguage) {
      return `Multi-Audio (${LANGUAGE_NAMES[language] || language})`;
    }
    return LANGUAGE_NAMES[language] || language;
  }, [language, recordingLanguage, isMultiLanguage]);

  // Custom buttons
  const customButtons = useMemo(() => {
    const buttons = [
      { action: "skipback", align: "center", faIcon: faClockRotateLeft },
      { action: "playpause", align: "center" },
      { action: "skipforward", align: "center", faIcon: faClockRotateLeft },
      {
        action: "custom", align: "right",
        label: isMuted ? "Unmute" : "Mute",
        faIcon: isMuted ? faVolumeXmark : faVolumeHigh,
        onPress: handleMutePress,
      },
      {
        action: "custom", align: "right",
        label: isInWatchlist ? "In Watchlist" : "Add to Watchlist",
        faIcon: isInWatchlist ? faBookmarkSolid : faBookmarkRegular,
        onPress: toggleWatchlist,
      },
    ];

    if (hasMultipleLanguages) {
      buttons.push({
        action: "custom", align: "left",
        label: languageButtonLabel,
        faIcon: faGlobe,
        onPress: handleLanguagePress,
      });
    }

    if (hasSubtitles) {
      buttons.push({
        action: "custom", align: "left",
        label: subtitleLanguage === 'none' ? 'Subtitles Off' : `Subtitles (${LANGUAGE_NAMES[subtitleLanguage] || subtitleLanguage})`,
        faIcon: faClosedCaptioning,
        onPress: handleSubtitlePress,
      });
    }

    return buttons;
  }, [isInWatchlist, toggleWatchlist, languageButtonLabel, handleLanguagePress, subtitleLanguage, handleSubtitlePress, hasSubtitles, hasMultipleLanguages, isMuted, handleMutePress]);

  if (!recording) {
    return <div>404</div>;
  }

  const videoUrl = startTime > 0 ? `${recording.url}#t=${Math.floor(startTime)}` : recording.url;
  const twoLetterLang = LANG_CODE_MAP[subtitleLanguage] || subtitleLanguage;
  const subtitleConfig = (activeSubtitle && subtitleLanguage !== 'none') ? {
    kind: 'subtitles',
    src: activeSubtitle,
    srcLang: twoLetterLang,
    label: LANGUAGE_NAMES[subtitleLanguage] || subtitleLanguage,
    default: true
  } : null;

  return (
    <div className={`player-wrapper ${controlsVisible ? 'player-wrapper--controls-visible' : 'player-wrapper--controls-hidden'}`}>
      <TVPlayer
        key={`${recording.url}-${language}-${startTime}`}
        url={videoUrl}
        title={event.title}
        subTitle={event.description}
        playing={playing}
        customButtons={customButtons}
        ref={playerRef}
        config={{ file: { tracks: subtitleConfig ? [subtitleConfig] : [] } }}
        onReady={(player) => {
          const videoElement = player?.getInternalPlayer?.();
          if (videoElement) {
            videoElementRef.current = videoElement;
            setIsVideoReady(true);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
      />

      {showLanguageSelector && (
        <SelectorModal
          title="Select Language"
          options={availableLanguages}
          selectedIndex={selectedLanguageIndex}
          currentValue={language}
          onSelect={(lang) => {
            setLanguage(lang);
            setShowLanguageSelector(false);
          }}
          onClose={() => setShowLanguageSelector(false)}
        />
      )}

      {showSubtitleSelector && (
        <SelectorModal
          title="Select Subtitles"
          options={subtitleOptions}
          selectedIndex={selectedSubtitleIndex}
          currentValue={subtitleLanguage}
          onSelect={(lang) => {
            if (playerRef.current) {
              const currentTime = playerRef.current.getCurrentTime();
              if (currentTime) setStartTime(currentTime);
            }
            setSubtitleLanguage(lang);
            setShowSubtitleSelector(false);
          }}
          onClose={() => setShowSubtitleSelector(false)}
        />
      )}
    </div>
  );
});

export default Player;
