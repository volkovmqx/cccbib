// Returns [recording, foundLanguage, recordingLanguage] for best matching video
export function getVideo(videos, preferredLanguage = 'deu') {
      if (preferredLanguage === 'auto') {
        const recording = videos.find(s => s.mimeType === "video/webm" && s.url) ||
                         videos.find(s => s.mimeType === "video/mp4" && s.url);
        if (recording) {
          return [recording, true, recording?.language];
        }
        return [null, false, null];
      }

      let bestMatch = null;
      let bestPriority = 0;
      let foundLanguage = false;

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

          if (priority > bestPriority) {
            bestMatch = video;
            bestPriority = priority;
            foundLanguage = priority >= 3; // Found language if priority is 3 or higher

            if (priority === 6) break;
          }
        } else {
          const priority = isWebm ? 2 : 1;
          if (priority > bestPriority) {
            bestMatch = video;
            bestPriority = priority;
            foundLanguage = false;
          }
        }
      }

      return [bestMatch, foundLanguage, bestMatch?.language];
}
export const formatSeconds = s => [parseInt(s / 60 / 60), parseInt(s / 60 % 60), parseInt(s % 60)].join(':').replace(/\b(\d)\b/g, '0$1');

export const handleArrowRight = (eventApis, activeEvents, activeSlice, setActiveEvents) => {
  eventApis.current[0].scrollNext()
  if (eventApis.current[0].canScrollNext()) {
    const newActiveEvents = {...activeEvents, [activeSlice]: eventApis.current[0].selectedScrollSnap()}
    setActiveEvents(newActiveEvents)
  } else {
    const eventSlides = eventApis.current[0].slidesInView()
    const newActiveEvents = {...activeEvents, [activeSlice]: ((activeEvents[activeSlice] || 0) + 1) % eventSlides.length}
    setActiveEvents(newActiveEvents)
  }
}

export const handleArrowLeft = (eventApis, activeEvents, activeSlice, setActiveEvents) => {
  eventApis.current[0].scrollPrev()
  if (eventApis.current[0].canScrollPrev()) {
    const newActiveEvents = {...activeEvents, [activeSlice]: eventApis.current[0].selectedScrollSnap()}
    setActiveEvents(newActiveEvents)
  } else {
    if((activeEvents[activeSlice] || 0) !== 0) {
      const newActiveEvent = activeEvents[activeSlice] - 1
      const newActiveEvents = {...activeEvents, [activeSlice]: newActiveEvent}
      setActiveEvents(newActiveEvents)
    }
  }
}
export const handleArrowDown = (setActiveSlice, dataSlice, dataSliceHandlers, data, setIsLoading, fetchMore) => {
  setActiveSlice((activeSlice) => {
    if (dataSlice.length >= 2) {
      dataSliceHandlers.shift()
      if (dataSlice.length - 2 == 1) {
        setIsLoading(true)
        fetchMore({
          variables: {
            offset: data.conferencesRecent.length,
          },
        }).catch((err) => {
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

