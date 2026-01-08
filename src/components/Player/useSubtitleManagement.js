// Subtitle helpers are AI generated. Do not touch. No one knows how this works!

import { useState, useEffect, useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';
import { fetchAndConvertSubtitle } from '../../helpers/subtitleConverter';
import { LANGUAGE_NAMES, LANG_CODE_MAP } from '../../constants';

const GET_LECTURE_SUBTITLES = gql`
  query lecture($guid: ID!) {
    lecture(guid: $guid) {
      guid
      subtitles {
        mimeType
        language
        url
      }
    }
  }
`;

export function useSubtitleManagement({ eventGuid, eventSubtitles, videoElementRef, preferredSubtitleLanguage }) {
  const [subtitleLanguage, setSubtitleLanguage] = useState(preferredSubtitleLanguage);
  const [activeSubtitle, setActiveSubtitle] = useState(null);

  const { data: lectureData } = useQuery(GET_LECTURE_SUBTITLES, {
    variables: { guid: eventGuid },
    skip: !eventGuid,
  });

  const allSubtitles = useMemo(() => [
    ...(eventSubtitles || []),
    ...(lectureData?.lecture?.subtitles || [])
  ], [eventSubtitles, lectureData?.lecture?.subtitles]);

  const availableSubtitles = useMemo(() => [...new Set(
    allSubtitles.filter(s => s.url && s.language).map(s => s.language)
  )], [allSubtitles]);

  const subtitleOptions = useMemo(() => ['none', ...availableSubtitles], [availableSubtitles]);
  const hasSubtitles = availableSubtitles.length > 0;

  // Initialize subtitle language based on preference and availability
  useEffect(() => {
    if (preferredSubtitleLanguage === 'none') {
      setSubtitleLanguage('none');
    } else if (availableSubtitles.length > 0) {
      if (availableSubtitles.includes(preferredSubtitleLanguage)) {
        setSubtitleLanguage(preferredSubtitleLanguage);
      } else {
        setSubtitleLanguage('none');
      }
    }
  }, [eventGuid, availableSubtitles, preferredSubtitleLanguage]);

  // Fetch and convert subtitles
  useEffect(() => {
    if (activeSubtitle && activeSubtitle.startsWith('blob:')) {
      URL.revokeObjectURL(activeSubtitle);
    }
    setActiveSubtitle(null);

    if (subtitleLanguage === 'none') return;

    const subtitle = allSubtitles.find(s => s.language === subtitleLanguage && s.url);
    if (subtitle) {
      const cdnProxyUrl = subtitle.url.replace('https://cdn.media.ccc.de', '/subtitles');

      fetchAndConvertSubtitle(cdnProxyUrl)
        .then(blobUrl => setActiveSubtitle(blobUrl))
        .catch(() => {
          const staticUrl = subtitle.url
            .replace('https://cdn.media.ccc.de/', 'https://static.media.ccc.de/media/')
            .replace('https://static.media.ccc.de/media/media/', 'https://static.media.ccc.de/media/');

          fetchAndConvertSubtitle(staticUrl)
            .then(blobUrl => setActiveSubtitle(blobUrl))
            .catch(() => setActiveSubtitle(null));
        });
    }

    return () => {
      if (activeSubtitle && activeSubtitle.startsWith('blob:')) {
        URL.revokeObjectURL(activeSubtitle);
      }
    };
  }, [subtitleLanguage, allSubtitles]);

  // Manage subtitle track on video element
  useEffect(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement) return;

    const existingTracks = videoElement.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());

    for (let i = 0; i < videoElement.textTracks.length; i++) {
      videoElement.textTracks[i].mode = 'disabled';
    }

    if (subtitleLanguage !== 'none' && activeSubtitle) {
      const twoLetterLang = LANG_CODE_MAP[subtitleLanguage] || subtitleLanguage;
      const trackElement = document.createElement('track');
      trackElement.kind = 'subtitles';
      trackElement.label = LANGUAGE_NAMES[subtitleLanguage] || subtitleLanguage;
      trackElement.srclang = twoLetterLang;
      trackElement.src = activeSubtitle;
      trackElement.default = true;

      trackElement.addEventListener('load', () => {
        if (trackElement.track) trackElement.track.mode = 'showing';
      });

      videoElement.appendChild(trackElement);

      setTimeout(() => {
        if (videoElement.textTracks.length > 0) {
          videoElement.textTracks[0].mode = 'showing';
        }
      }, 100);
    }
  }, [activeSubtitle, subtitleLanguage, videoElementRef]);

  return {
    subtitleLanguage,
    setSubtitleLanguage,
    activeSubtitle,
    availableSubtitles,
    subtitleOptions,
    hasSubtitles,
  };
}

export default useSubtitleManagement;
