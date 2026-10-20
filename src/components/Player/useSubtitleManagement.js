import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '../../graphql';
import { GET_LECTURE_SUBTITLES } from '../../data';
import { getSubtitleLanguages, getSubtitleSources, loadSubtitleCues } from '../../helpers/subtitles';
import { getSavedSubtitleLanguage, saveSubtitleLanguage } from '../../helpers/subtitleChoice';
import { LANGUAGE_NAMES, LANG_CODE_MAP } from '../../constants';

const NO_SUBTITLES = [];
const NONE_UNAVAILABLE = [];

function clearTrack(track) {
  track.mode = 'disabled';
  while (track.cues && track.cues.length > 0) track.removeCue(track.cues[0]);
}

export function useSubtitleManagement({ eventGuid, eventSubtitles, videoElement, preferredSubtitleLanguage }) {
  const needsLookup = Boolean(eventGuid) && !Array.isArray(eventSubtitles);
  const { data } = useQuery(`subtitles:${eventGuid}`, GET_LECTURE_SUBTITLES, { guid: eventGuid }, { skip: !needsLookup, revalidate: false });

  const subtitles = (needsLookup ? data?.lecture?.subtitles : eventSubtitles) || NO_SUBTITLES;
  const listedSubtitles = useMemo(() => getSubtitleLanguages(subtitles), [subtitles]);

  // The catalog lists dead (404) and placeholder files, so unusable languages are dropped
  const [unavailable, setUnavailable] = useState({ guid: null, languages: NONE_UNAVAILABLE });
  const unavailableLanguages = unavailable.guid === eventGuid ? unavailable.languages : NONE_UNAVAILABLE;
  const markUnavailable = (language) => setUnavailable((prev) => {
    const languages = prev.guid === eventGuid ? prev.languages : NONE_UNAVAILABLE;
    return languages.includes(language) ? prev : { guid: eventGuid, languages: [...languages, language] };
  });
  const availableSubtitles = useMemo(
    () => listedSubtitles.filter((language) => !unavailableLanguages.includes(language)),
    [listedSubtitles, unavailableLanguages]
  );
  const subtitleOptions = useMemo(() => ['none', ...availableSubtitles], [availableSubtitles]);
  const hasSubtitles = availableSubtitles.length > 0;

  const [choice, setChoice] = useState({ guid: null, language: null });
  const defaultLanguage = availableSubtitles.includes(preferredSubtitleLanguage) ? preferredSubtitleLanguage : 'none';
  const savedLanguage = useMemo(() => getSavedSubtitleLanguage(eventGuid), [eventGuid]);
  const wantedLanguage = choice.guid === eventGuid ? choice.language : savedLanguage;
  const chosen = subtitleOptions.includes(wantedLanguage) ? wantedLanguage : null;
  const subtitleLanguage = chosen || defaultLanguage;
  const setSubtitleLanguage = (language) => {
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
    let track = null;
    setStatus('loading');

    loadSubtitleCues(sources, controller && controller.signal)
      .then((cues) => {
        if (cancelled) return;
        track = videoElement.addTextTrack(
          'subtitles',
          LANGUAGE_NAMES[subtitleLanguage] || subtitleLanguage,
          LANG_CODE_MAP[subtitleLanguage] || subtitleLanguage
        );
        cues.forEach((cue) => track.addCue(new window.VTTCue(cue.start, cue.end, cue.text)));
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

    (async () => {
      for (const language of listedSubtitles) {
        if (cancelled) return;
        try {
          await loadSubtitleCues(getSubtitleSources(subtitles, language), controller && controller.signal);
        } catch (error) {
          if (cancelled) return;
          markUnavailable(language);
        }
      }
    })();

    return () => {
      cancelled = true;
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

export default useSubtitleManagement;
