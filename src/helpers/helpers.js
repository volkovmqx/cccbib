// Returns [recording, foundLanguage, recordingLanguage] for best matching video
export function getVideo(videos, preferredLanguage = 'deu') {
      if (preferredLanguage === 'auto') {
        const widest = (mimeType) => videos
          .filter(s => s.mimeType === mimeType && s.url)
          .reduce((best, s) => (!best || (s.width || 0) > (best.width || 0) ? s : best), null);
        const recording = widest("video/webm") || widest("video/mp4");
        if (recording) {
          return [recording, true, recording?.language];
        }
        return [null, false, null];
      }

      let bestMatch = null;
      let bestPriority = 0;
      let foundLanguage = false;
      const isBetter = (priority, video) => priority > bestPriority
        || (priority === bestPriority && bestMatch && (video.width || 0) > (bestMatch.width || 0));

      for (const video of videos) {
        if (!video.url) continue;

        const isWebm = video.mimeType === "video/webm";
        const isMp4 = video.mimeType === "video/mp4";

        if (!isWebm && !isMp4) continue;

        if (video.language) {
          const languages = video.language.split('-');
          const isExactMatch = languages.length === 1 && languages[0] === preferredLanguage;
          const includesLanguage = languages.includes(preferredLanguage);

          // Priority: 6=single WEBM, 5=single MP4, 4=multi WEBM, 3=multi MP4, 2=any WEBM, 1=any MP4
          let priority = 0;
          if (isExactMatch && isWebm) {
            priority = 6;
          } else if (isExactMatch && isMp4) {
            priority = 5;
          } else if (includesLanguage && isWebm) {
            priority = 4;
          } else if (includesLanguage && isMp4) {
            priority = 3;
          } else if (isWebm) {
            priority = 2;
          } else if (isMp4) {
            priority = 1;
          }

          if (isBetter(priority, video)) {
            bestMatch = video;
            bestPriority = priority;
            foundLanguage = priority >= 3; // Found language if priority is 3 or higher
          }
        } else {
          const priority = isWebm ? 2 : 1;
          if (isBetter(priority, video)) {
            bestMatch = video;
            bestPriority = priority;
            foundLanguage = false;
          }
        }
      }

      return [bestMatch, foundLanguage, bestMatch?.language];
}
export function isOddAspect(videos, preferredLanguage) {
  const [recording] = getVideo(videos || [], preferredLanguage);
  if (!recording || !recording.width || !recording.height) return false;
  return Math.abs(recording.width / recording.height - 16 / 9) > 0.08;
}

export function getPreviewVideo(videos, preferredLanguage) {
  const [best] = getVideo(videos, preferredLanguage);
  if (!best) return null;
  const sameKind = videos.filter(v => v.url && v.width && v.mimeType === best.mimeType && v.language === best.language);
  if (sameKind.length === 0) return best;
  return sameKind.reduce((smallest, v) => (v.width < smallest.width ? v : smallest));
}

// webOS has a single hardware decoder, so a video has to be unloaded explicitly before the next one starts
export function releaseVideo(video) {
  if (!video) return;
  try {
    video.pause();
    video.removeAttribute('src');
    video.load();
  } catch (error) {
  }
}

export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};

export const formatSeconds = s => [parseInt(s / 60 / 60), parseInt(s / 60 % 60), parseInt(s % 60)].join(':').replace(/\b(\d)\b/g, '0$1');

export const handleArrowRight = (eventApis, activeEvents, activeSlice, setActiveEvents) => {
  const api = eventApis.current[0]
  const current = activeEvents[activeSlice] || 0
  if (current >= api.slideNodes().length - 1) return
  if (api.canScrollNext() && current >= api.selectedScrollSnap()) api.scrollNext()
  setActiveEvents({ ...activeEvents, [activeSlice]: current + 1 })
}

export const handleArrowLeft = (eventApis, activeEvents, activeSlice, setActiveEvents) => {
  const api = eventApis.current[0]
  const current = activeEvents[activeSlice] || 0
  if (current <= 0) return
  if (current <= api.selectedScrollSnap()) api.scrollPrev()
  setActiveEvents({ ...activeEvents, [activeSlice]: current - 1 })
}
export const handleArrowDown = (setActiveSlice, dataSlice, dataSliceHandlers, data, setIsLoading, fetchMore) => {
  setActiveSlice((activeSlice) => {
    if (dataSlice.length >= 2) {
      dataSliceHandlers.shift()
      if (dataSlice.length - 2 == 1) {
        setIsLoading(true)
        fetchMore(data.fetched || data.conferencesRecent.length).catch((err) => {
          console.error('Failed to fetch more conferences:', err);
          setIsLoading(false);
        })
      }

      return activeSlice + 1
    }
    return activeSlice
  })

}

export const handleArrowUp = (setActiveSlice, dataSliceHandlers, data) => {
  setActiveSlice((activeSlice) => {
    if (activeSlice - 1 >= 0) {
      dataSliceHandlers.prepend(data.conferencesRecent[activeSlice - 1])
      return activeSlice - 1

    }
    return activeSlice
  })
  
}

