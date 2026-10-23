import type { SubtitleSource } from '@/entities/talk';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@/shared/api';
import { GET_LECTURE_SUBTITLES } from '@/entities/talk';
import { getSubtitleLanguages, getSubtitleSources, loadSubtitleCues } from '@/shared/lib';
import { getSavedSubtitleLanguage, saveSubtitleLanguage } from './subtitleChoice';
import { LANGUAGE_NAMES, LANG_CODE_MAP } from '@/shared/config';

const NO_SUBTITLES: SubtitleSource[] = [];
const NONE_UNAVAILABLE: string[] = [];
const PROBE_DELAY_MS = 4000;

function clearTrack(track: TextTrack) {
  track.mode = 'disabled';
  while (track.cues && track.cues.length > 0) track.removeCue(track.cues[0]);
}

export function useSubtitleManagement({ eventGuid, eventSubtitles, videoElement, preferredSubtitleLanguage }: { eventGuid?: string; eventSubtitles?: SubtitleSource[]; videoElement: HTMLVideoElement | null; preferredSubtitleLanguage: string }) {
  const needsLookup = Boolean(eventGuid) && !Array.isArray(eventSubtitles);
  const { data } = useQuery<{ lecture?: { subtitles?: SubtitleSource[] } }>(`subtitles:${eventGuid}`, GET_LECTURE_SUBTITLES, { guid: eventGuid }, { skip: !needsLookup, revalidate: false });

  const subtitles = (needsLookup ? data?.lecture?.subtitles : eventSubtitles) || NO_SUBTITLES;
  const listedSubtitles = useMemo(() => getSubtitleLanguages(subtitles), [subtitles]);

  // The catalog lists dead (404) and placeholder files, so unusable languages are dropped
  const [unavailable, setUnavailable] = useState<{ guid: string | null | undefined; languages: string[] }>({ guid: null, languages: NONE_UNAVAILABLE });
  const unavailableLanguages = unavailable.guid === eventGuid ? unavailable.languages : NONE_UNAVAILABLE;
  const markUnavailable = (language: string) => setUnavailable((prev) => {
    const languages = prev.guid === eventGuid ? prev.languages : NONE_UNAVAILABLE;
    return languages.includes(language) ? prev : { guid: eventGuid, languages: [...languages, language] };
  });
  const availableSubtitles = useMemo(
    () => listedSubtitles.filter((language) => !unavailableLanguages.includes(language)),
    [listedSubtitles, unavailableLanguages]
  );
  const subtitleOptions = useMemo(() => ['none', ...availableSubtitles], [availableSubtitles]);
  const hasSubtitles = availableSubtitles.length > 0;

  const [choice, setChoice] = useState<{ guid: string | null | undefined; language: string | null }>({ guid: null, language: null });
  const defaultLanguage = availableSubtitles.includes(preferredSubtitleLanguage) ? preferredSubtitleLanguage : 'none';
  const savedLanguage = useMemo(() => getSavedSubtitleLanguage(eventGuid), [eventGuid]);
  const wantedLanguage = choice.guid === eventGuid ? choice.language : savedLanguage;
  const chosen = wantedLanguage !== null && subtitleOptions.includes(wantedLanguage) ? wantedLanguage : null;
  const subtitleLanguage = chosen || defaultLanguage;
  const setSubtitleLanguage = (language: string) => {
    setChoice({ guid: eventGuid, language });
    saveSubtitleLanguage(eventGuid, language);
  };

  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!videoElement) return undefined;

    Array.from(videoElement.textTracks || []).forEach(clearTrack);

    if (subtitleLanguage === 'none') {
      setStatus('idle');
      return undefined;
    }

    const sources = getSubtitleSources(subtitles, subtitleLanguage);
    if (sources.length === 0) {
      setStatus(needsLookup && !data ? 'loading' : 'error');
      return undefined;
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let cancelled = false;
    let track: TextTrack | null = null;
    setStatus('loading');

    loadSubtitleCues(sources, controller && controller.signal)
      .then((cues) => {
        if (cancelled) return;
        track = videoElement.addTextTrack(
          'subtitles',
          LANGUAGE_NAMES[subtitleLanguage] || subtitleLanguage,
          LANG_CODE_MAP[subtitleLanguage] || subtitleLanguage
        );
        cues.forEach((cue) => track!.addCue(new window.VTTCue(cue.start, cue.end, cue.text)));
        track.mode = 'showing';
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        markUnavailable(subtitleLanguage);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (controller) controller.abort();
      if (track) clearTrack(track);
    };
  }, [videoElement, subtitleLanguage, subtitles, needsLookup, data]);

  useEffect(() => {
    if (listedSubtitles.length === 0) return undefined;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let cancelled = false;

    // The check for dead languages waits until the video has started so it does not compete with it
    const timer = setTimeout(async () => {
      for (const language of listedSubtitles) {
        if (cancelled) return;
        try {
          await loadSubtitleCues(getSubtitleSources(subtitles, language), controller && controller.signal);
        } catch (error) {
          if (cancelled) return;
          markUnavailable(language);
        }
      }
    }, PROBE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [subtitles, listedSubtitles, eventGuid]);

  return {
    subtitleLanguage,
    setSubtitleLanguage,
    subtitleStatus: status,
    availableSubtitles,
    subtitleOptions,
    hasSubtitles,
  };
}

