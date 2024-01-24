import { useLocalStorage } from "@mantine/hooks";


export function getVideo(videos) {
    const [language] = useLocalStorage({
        key: 'language',
        defaultValue: 'deu',
      });
      let recording = videos.find(
        (s) => (s.language === language && s.mimeType === "video/mp4" && s.url)
      );
      let foundLanguage = true;
      // check if another language is available
      let otherLanguage = language === "deu" ? "eng" : "deu";
      const otherLanguageAvailable = videos.find(
        (s) => (s.language === otherLanguage && s.mimeType === "video/mp4" && s.url)
      );
      // video in language not found, try to find any video
      if (!recording) {
        recording = videos.find(
          (s) => s.mimeType === "video/mp4" && s.url
        );
        foundLanguage = false;
      }
      return [recording, foundLanguage];
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
    if((activeEvents[activeSlice] || 0) == 0) {
      console.log("cannot scroll prev -- open the sidebar")
    } else {
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

