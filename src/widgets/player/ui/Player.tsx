import type { PlayerProps, PlayerButton, Selector } from '../model/types';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  IconWorld, IconBadgeCc, IconAspectRatio, IconRewindBackward10, IconRewindForward10,
  IconPlayerPlayFilled, IconPlayerPauseFilled, IconVolume, IconVolumeOff, IconBookmark, IconBookmarkFilled,
} from '@tabler/icons-react';
import { getVideo, releaseVideo } from '@/entities/talk';
import { videoSources, rememberMirror } from '@/entities/talk';
import { getSavedPlaybackPosition, removePlaybackHistoryItem } from '@/features/playback-history';
import { LANGUAGE_NAMES, ASPECT_RATIOS } from '@/shared/config';
import { useSetting } from '@/shared/config';
import { useWatchlist } from '@/features/watchlist';
import { useTranslation } from '@/shared/i18n';
import { usePlayerKeyboard } from '../model/usePlayerKeyboard';
import { useControlsVisibility } from '../model/useControlsVisibility';
import { Controls } from './Controls';
import { Spinner } from '@/shared/ui';
import { usePlaybackPosition } from '../model/usePlaybackPosition';
import { useSubtitleManagement } from '../model/useSubtitleManagement';
import { useOutputWindow } from '../model/useOutputWindow';
import { useRemoteControl } from '../model/useRemoteControl';
import { setNowPlayingReader } from '../model/nowPlaying';
import { SelectorModal } from './SelectorModal';

const IDLE_TITLE = document.title;
const TOAST_MS = 3000;
const SOURCE_DELAY_MS = 200;
const STALL_CHECK_MS = 4000;
const START_TIMEOUT_MS = 12000;
const RESUME_SETTLE_MS = 150;
const NUDGE_DELAY_MS = 300;
const NUDGE_SECONDS = 0.01;
const RESUME_SEEK_TIMEOUT_MS = 8000;
const PAUSING_SELECTORS = ['language', 'subtitle'];

const aspectName = (code: string) => (ASPECT_RATIOS.find((aspect) => aspect.code === code) || {}).name || code;

export const Player = React.memo(function Player({ event, conferenceTitle, onClose, startAt }: PlayerProps) {
  const t = useTranslation();
  const languageName = useCallback((code: string) => t(LANGUAGE_NAMES[code] || code), [t]);
  const selectorTitles = {
    language: t('Select Language'),
    subtitle: t('Select Subtitles'),
    aspect: t('Aspect Ratio'),
  };
  const selectorLabels: Partial<Record<Selector, (value: string) => string>> = {
    aspect: (value: string) => t(aspectName(value)),
  };
  const [preferredAudioLanguage] = useSetting('language');
  const [preferredSubtitleLanguage] = useSetting('subtitleLanguage');
  const [defaultAspect] = useSetting('aspectRatio');

  const [languageChoice, setLanguageChoice] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(defaultAspect);
  const [selector, setSelector] = useState<Selector | null>(null);
  const [selectorIndex, setSelectorIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [buffering, setBuffering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [videoRatio, setVideoRatio] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [savedStart] = useState(() => (Number.isFinite(startAt) ? startAt! : getSavedPlaybackPosition(event.guid)));

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef(savedStart);
  const resumePendingRef = useRef(savedStart > 0);
  const playingRef = useRef(playing);
  const resumeAfterSelectorRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  playingRef.current = playing;

  const {
    isInWatchlist,
    toggleWatchlist: toggleWatchlistBase,
    removeFromWatchlist,
  } = useWatchlist(event.guid);

  const toggleWatchlist = useCallback(() => {
    toggleWatchlistBase({
      guid: event.guid,
      slug: event.slug,
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

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const controls = useControlsVisibility({ selectorOpen: Boolean(selector), playing });

  const { saveCurrentPosition } = usePlaybackPosition({
    event,
    conferenceTitle,
    videoElementRef,
    isInWatchlist,
    removeFromWatchlist,
    playing,
  });

  const {
    subtitleLanguage,
    setSubtitleLanguage,
    subtitleStatus,
    subtitleOptions,
    hasSubtitles,
  } = useSubtitleManagement({
    eventGuid: event.guid,
    eventSubtitles: event.subtitles,
    videoElement,
    preferredSubtitleLanguage,
  });

  const availableLanguages = useMemo(() => [...new Set(
    event.videos
      .filter(v => v.mimeType === 'video/webm' && v.url && v.language)
      .flatMap(v => v.language.split('-'))
  )], [event.videos]);

  const hasMultipleLanguages = availableLanguages.length > 1;

  const initialLanguage = availableLanguages.includes(preferredAudioLanguage)
    ? preferredAudioLanguage
    : availableLanguages[0] || preferredAudioLanguage;
  const language = languageChoice || initialLanguage;

  const [recording, recordingLanguage] = useMemo(
    () => getVideo(event.videos, language),
    [event.videos, language]
  );
  const isMultiLanguage = Boolean(recordingLanguage && recordingLanguage.includes('-'));

  // Attach the source a moment after mounting so a preview video can release the decoder
  const [sourceReady, setSourceReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSourceReady(true), SOURCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const sources = useMemo(() => (recording ? videoSources(recording.url) : []), [recording?.url]);
  const [sourceState, setSourceState] = useState<{ url: string | null; index: number }>({ url: null, index: 0 });
  const sourceIndex = recording && sourceState.url === recording.url ? sourceState.index : 0;
  const videoUrl = sourceReady && recording ? sources[sourceIndex] : undefined;

  useEffect(() => {
    if (!videoElement) return;
    videoElement.muted = isMuted;
  }, [videoElement, isMuted]);

  const startPlayback = useCallback(() => {
    const element = videoElementRef.current;
    if (!element || !playingRef.current || !element.paused || resumePendingRef.current) return;
    const result = element.play();
    if (result && result.catch) result.catch(() => {});
  }, []);

  useEffect(() => {
    if (!videoElement) return;
    if (playing) startPlayback();
    else videoElement.pause();
  }, [videoElement, playing, startPlayback]);

  const advanceSource = useCallback(() => {
    if (!recording) return;
    if (sourceIndex >= sources.length - 1) {
      setFailed(true);
      return;
    }
    const element = videoElementRef.current;
    if (element && element.currentTime > 0) startTimeRef.current = element.currentTime;
    resumePendingRef.current = startTimeRef.current > 0;
    setSourceState({ url: recording.url, index: sourceIndex + 1 });
    setBuffering(true);
  }, [recording, sources, sourceIndex]);
  const advanceSourceRef = useRef(advanceSource);
  advanceSourceRef.current = advanceSource;

  useEffect(() => {
    if (!videoElement) return undefined;
    const timer = setTimeout(() => {
      if (videoElement.readyState < 1) advanceSourceRef.current();
    }, START_TIMEOUT_MS);
    const remember = () => rememberMirror(videoElement.currentSrc);
    videoElement.addEventListener('loadedmetadata', remember);
    return () => {
      clearTimeout(timer);
      videoElement.removeEventListener('loadedmetadata', remember);
    };
  }, [videoElement]);

  // Resume by seeking once the metadata is known, a #t= fragment can leave webOS with sound but no picture
  useEffect(() => {
    if (!videoElement) return undefined;
    const target = startTimeRef.current;
    resumePendingRef.current = target > 0;
    if (!(target > 0)) return undefined;
    let applied = false;
    let doubled = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        resumePendingRef.current = false;
        startPlayback();
      }, RESUME_SETTLE_MS);
    };
    // A second tiny seek while paused stops the picture freezing after resume
    const onSeeked = () => {
      if (!applied) return;
      if (!doubled) {
        doubled = true;
        try {
          videoElement.currentTime += NUDGE_SECONDS;
          return;
        } catch (error) {
          console.error('Could not settle resume position', error);
        }
      }
      finish();
    };
    const apply = () => {
      if (applied || videoElement.readyState < 1) return;
      applied = true;
      const limit = Number.isFinite(videoElement.duration) ? Math.max(0, videoElement.duration - 5) : target;
      try {
        videoElement.currentTime = Math.min(target, limit);
      } catch (error) {
        console.error('Could not resume playback', error);
        finish();
      }
    };
    const giveUp = setTimeout(() => {
      if (resumePendingRef.current) finish();
    }, RESUME_SEEK_TIMEOUT_MS);
    apply();
    videoElement.addEventListener('loadedmetadata', apply);
    videoElement.addEventListener('loadeddata', apply);
    videoElement.addEventListener('seeked', onSeeked);
    return () => {
      clearTimeout(giveUp);
      clearTimeout(settleTimer);
      videoElement.removeEventListener('loadedmetadata', apply);
      videoElement.removeEventListener('loadeddata', apply);
      videoElement.removeEventListener('seeked', onSeeked);
    };
  }, [videoElement, startPlayback]);

  // After a seek webOS freezes the picture for seconds, a tiny re-seek resyncs it
  useEffect(() => {
    if (!videoElement) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let nudging = false;
    const nudge = () => {
      if (videoElement.paused || videoElement.seeking || videoElement.ended) return;
      nudging = true;
      try {
        videoElement.currentTime += NUDGE_SECONDS;
      } catch (error) {
        nudging = false;
      }
    };
    const onSeeked = () => {
      if (nudging) {
        nudging = false;
        return;
      }
      if (resumePendingRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(nudge, NUDGE_DELAY_MS);
    };
    videoElement.addEventListener('seeked', onSeeked);
    return () => {
      clearTimeout(timer);
      videoElement.removeEventListener('seeked', onSeeked);
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return undefined;
    const startIfWanted = startPlayback;
    videoElement.addEventListener('canplay', startIfWanted);
    videoElement.addEventListener('seeked', startIfWanted);

    let lastTime = -1;
    let lastFrames = -1;
    let framesAlive = false;
    let stalls = 0;
    let seekingTicks = 0;
    const timer = setInterval(() => {
      if (videoElement.seeking && playingRef.current) {
        seekingTicks += 1;
        if (seekingTicks >= 2) {
          seekingTicks = 0;
          advanceSourceRef.current();
        }
      } else {
        seekingTicks = 0;
      }
      if (!playingRef.current || videoElement.paused || videoElement.ended || videoElement.seeking || videoElement.readyState < 2) {
        lastTime = -1;
        stalls = 0;
        return;
      }
      const frames = videoElement.webkitDecodedFrameCount;
      if (typeof frames === 'number' && frames > lastFrames && lastFrames >= 0) framesAlive = true;
      const clockStuck = Math.abs(videoElement.currentTime - lastTime) < 0.05;
      const pictureStuck = framesAlive && typeof frames === 'number' && frames === lastFrames;
      lastTime = videoElement.currentTime;
      lastFrames = typeof frames === 'number' ? frames : -1;
      stalls = clockStuck || pictureStuck ? stalls + 1 : 0;
      if (stalls >= 2) {
        stalls = 0;
        try {
          videoElement.currentTime = Math.max(0, videoElement.currentTime - 1);
        } catch (error) {
          console.error('Could not recover playback', error);
        }
        startIfWanted();
      }
    }, STALL_CHECK_MS);

    return () => {
      clearInterval(timer);
      videoElement.removeEventListener('canplay', startIfWanted);
      videoElement.removeEventListener('seeked', startIfWanted);
    };
  }, [videoElement, startPlayback]);

  useEffect(() => {
    setBuffering(true);
    setFailed(false);
    setVideoRatio(null);
  }, [recording && recording.url]);

  useEffect(() => {
    if (!videoElement) return undefined;
    const update = () => setVideoRatio(videoElement.videoWidth && videoElement.videoHeight ? videoElement.videoWidth / videoElement.videoHeight : null);
    update();
    videoElement.addEventListener('loadedmetadata', update);
    videoElement.addEventListener('resize', update);
    return () => {
      videoElement.removeEventListener('loadedmetadata', update);
      videoElement.removeEventListener('resize', update);
    };
  }, [videoElement]);

  useOutputWindow(videoElement, aspectRatio);

  useEffect(() => {
    document.title = `${playing ? 'Playing' : 'Paused'}: ${event.title}`;
  }, [playing, event.title]);
  useEffect(() => () => { document.title = IDLE_TITLE; }, []);

  useEffect(() => {
    setNowPlayingReader(() => {
      const element = videoElementRef.current;
      return { event, playing: playingRef.current, position: element ? element.currentTime : 0, duration: (element && element.duration) || event.duration };
    });
    return () => setNowPlayingReader(null);
  }, [event]);

  const showAspect = aspectRatio !== 'auto' || (videoRatio !== null && Math.abs(videoRatio - 16 / 9) > 0.08);

  useEffect(() => {
    if (subtitleStatus === 'error') showToast(t('Subtitles are not available for this talk'));
  }, [subtitleStatus, showToast]);

  const selectorOptions = useMemo(() => ({
    language: availableLanguages,
    subtitle: subtitleOptions,
    aspect: ASPECT_RATIOS.map((aspect) => aspect.code),
  }), [availableLanguages, subtitleOptions]);

  const currentValues = { language, subtitle: subtitleLanguage, aspect: aspectRatio };

  const openSelector = useCallback((name: Selector) => {
    const options = selectorOptions[name];
    if (!options || options.length === 0) return;
    if (PAUSING_SELECTORS.includes(name)) {
      resumeAfterSelectorRef.current = playingRef.current;
      setPlaying(false);
    }
    setSelectorIndex(Math.max(0, options.indexOf(currentValues[name])));
    setSelector(name);
  }, [selectorOptions, language, subtitleLanguage, aspectRatio]);

  const closeSelector = useCallback(() => {
    setSelector(null);
    if (resumeAfterSelectorRef.current) {
      resumeAfterSelectorRef.current = false;
      setPlaying(true);
    }
  }, []);

  const applySelection = useCallback((name: Selector, value: string) => {
    if (name === 'language') {
      if (value !== language) {
        const [next] = getVideo(event.videos, value);
        if (next && recording && next.url !== recording.url) {
          startTimeRef.current = videoElementRef.current?.currentTime || 0;
          resumePendingRef.current = startTimeRef.current > 0;
        }
        setLanguageChoice(value);
      }
    } else if (name === 'subtitle') {
      setSubtitleLanguage(value);
    } else if (name === 'aspect') {
      setAspectRatio(value);
      showToast(t('Aspect ratio: {name}', { name: t(aspectName(value)) }));
    }
    closeSelector();
  }, [language, event.videos, recording, setSubtitleLanguage, showToast, closeSelector, t]);

  const confirmSelector = useCallback((index: number) => {
    if (selector) applySelection(selector, selectorOptions[selector][index]);
  }, [selector, selectorOptions, applySelection]);

  const seek = useCallback((delta: number) => {
    const element = videoElementRef.current;
    if (element) element.currentTime = Math.max(0, Math.min(element.duration || 0, element.currentTime + delta));
  }, []);

  const seekTo = useCallback((time: number) => {
    const element = videoElementRef.current;
    if (element) element.currentTime = time;
  }, []);

  const toggleMute = useCallback(() => setIsMuted((muted) => !muted), []);

  const languageButtonLabel = useMemo(() => {
    if (language === 'auto' && recordingLanguage) {
      return t('Auto ({languages})', { languages: recordingLanguage.split('-').map(languageName).join('-') });
    }
    if (isMultiLanguage) {
      return t('Multi-Audio ({language})', { language: languageName(language) });
    }
    return languageName(language);
  }, [language, recordingLanguage, isMultiLanguage, t, languageName]);

  const buttons = useMemo(() => {
    const list: PlayerButton[] = [];
    if (hasMultipleLanguages) {
      list.push({ id: 'language', align: 'left', label: languageButtonLabel, icon: <IconWorld />, onPress: () => openSelector('language') });
    }
    if (hasSubtitles) {
      list.push({
        id: 'subtitle', align: 'left',
        label: subtitleLanguage === 'none' ? t('Subtitles Off') : t('Subtitles ({language})', { language: languageName(subtitleLanguage) }),
        icon: <IconBadgeCc />, onPress: () => openSelector('subtitle'),
      });
    }
    if (showAspect) {
      list.push({ id: 'aspect', align: 'left', label: t('Aspect: {name}', { name: t(aspectName(aspectRatio)) }), icon: <IconAspectRatio />, onPress: () => openSelector('aspect') });
    }
    list.push(
      { id: 'skipback', align: 'center', label: t('Skip Back'), icon: <IconRewindBackward10 />, onPress: () => seek(-10) },
      {
        id: 'playpause', align: 'center', label: playing ? t('Pause') : t('Play'),
        icon: playing ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />, onPress: () => setPlaying((value) => !value),
      },
      { id: 'skipforward', align: 'center', label: t('Skip Forward'), icon: <IconRewindForward10 />, onPress: () => seek(10) },
      { id: 'mute', align: 'right', label: isMuted ? t('Unmute') : t('Mute'), icon: isMuted ? <IconVolumeOff /> : <IconVolume />, onPress: toggleMute },
      {
        id: 'watchlist', align: 'right', label: isInWatchlist ? t('In Watchlist') : t('Add to Watchlist'),
        icon: isInWatchlist ? <IconBookmarkFilled /> : <IconBookmark />, onPress: toggleWatchlist,
      },
    );
    return list;
  }, [
    hasMultipleLanguages, hasSubtitles, languageButtonLabel, subtitleLanguage, aspectRatio,
    playing, isMuted, isInWatchlist, openSelector, seek, toggleMute, toggleWatchlist, t, languageName, showAspect,
  ]);

  usePlayerKeyboard({
    onClose,
    controls,
    selector,
    selectorLength: selector ? selectorOptions[selector].length : 0,
    selectorIndex,
    setSelectorIndex,
    openSelector,
    confirmSelector,
    closeSelector,
    buttons,
    hasMultipleLanguages,
    hasSubtitles,
    setPlaying,
    seek,
    toggleMute,
  });

  useRemoteControl((command) => {
    const { cmd, value } = command;
    if (cmd === 'pause') setPlaying(false);
    else if (cmd === 'resume') setPlaying(true);
    else if (cmd === 'toggle') setPlaying((current) => !current);
    else if (cmd === 'mute') setIsMuted((current) => (typeof value === 'boolean' ? value : !current));
    else if (cmd === 'stop') onClose();
    else if (cmd === 'aspect' && typeof value === 'string' && ASPECT_RATIOS.some((aspect) => aspect.code === value)) applySelection('aspect', value);
    else if (cmd === 'subtitle' && typeof value === 'string') setSubtitleLanguage(value);
    else if (cmd === 'language' && typeof value === 'string' && availableLanguages.includes(value)) applySelection('language', value);
    else if (cmd === 'seek') {
      const element = videoElementRef.current;
      if (Number.isFinite(command.by)) seek(command.by!);
      else if (Number.isFinite(command.to) && element && element.readyState > 0) seekTo(command.to!);
      else if (Number.isFinite(command.to)) {
        startTimeRef.current = command.to!;
        resumePendingRef.current = command.to! > 0;
      }
    }
  });

  const saveCurrentPositionRef = useRef(saveCurrentPosition);
  saveCurrentPositionRef.current = saveCurrentPosition;

  const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
    if (!element && videoElementRef.current) saveCurrentPositionRef.current();
    videoElementRef.current = element;
    setVideoElement(element);
  }, []);

  useEffect(() => {
    if (!videoElement) return undefined;
    return () => releaseVideo(videoElement);
  }, [videoElement]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    saveCurrentPosition();
  }, [saveCurrentPosition]);

  const handleEnded = useCallback(() => {
    removePlaybackHistoryItem(event.guid);
    if (isInWatchlist) toggleWatchlist();
    onClose();
  }, [event.guid, isInWatchlist, toggleWatchlist, onClose]);

  if (!recording) {
    return <div className="player-message">{t('No recording available')}</div>;
  }

  const aspect = ASPECT_RATIOS.find((item) => item.code === aspectRatio) || ASPECT_RATIOS[0];

  return (
    <div
      className={`player-wrapper ${controls.visible ? 'player-wrapper--controls-visible' : 'player-wrapper--controls-hidden'}`}
      onMouseMove={controls.show}
    >
      <video
        key={`${recording.url}#${sourceIndex}`}
        ref={handleVideoRef}
        className="player-video"
        src={videoUrl}
        playsInline
        style={{ objectFit: aspect.objectFit }}
        onClick={() => setPlaying((value) => !value)}
        onPlay={() => setPlaying(true)}
        onPause={handlePause}
        onEnded={handleEnded}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => { if (!resumePendingRef.current) setBuffering(false); }}
        onError={() => advanceSource()}
      />

      {buffering && !failed && <div className="player-buffering"><Spinner /></div>}
      {failed && <div className="player-message">{t('This video could not be played')}</div>}

      <Controls
        title={event.title}
        subTitle={event.description}
        buttons={buttons}
        focus={controls.focus}
        video={videoElement}
        onSeek={seekTo}
      />

      {toast && <div className="player-toast">{toast}</div>}

      {selector && (
        <SelectorModal
          title={selectorTitles[selector]}
          options={selectorOptions[selector]}
          selectedIndex={selectorIndex}
          currentValue={currentValues[selector]}
          getLabel={selectorLabels[selector]}
          onSelect={(value) => applySelection(selector, value)}
          onClose={closeSelector}
        />
      )}
    </div>
  );
});

