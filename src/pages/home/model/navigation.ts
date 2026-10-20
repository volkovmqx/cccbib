import type { Conference, RecentData } from '@/entities/conference';
import type { CarouselApi } from './types';

type Handlers = { shift: () => void; prepend: (...items: Conference[]) => void };
export const handleArrowRight = (eventApis: React.RefObject<CarouselApi[]>, activeEvents: Record<string, number>, activeSlice: string | number, setActiveEvents: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
  const api = eventApis.current[0]
  const current = activeEvents[activeSlice] || 0
  if (current >= api.slideNodes().length - 1) return
  if (api.canScrollNext() && current >= api.selectedScrollSnap()) api.scrollNext()
  setActiveEvents({ ...activeEvents, [activeSlice]: current + 1 })
}

export const handleArrowLeft = (eventApis: React.RefObject<CarouselApi[]>, activeEvents: Record<string, number>, activeSlice: string | number, setActiveEvents: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
  const api = eventApis.current[0]
  const current = activeEvents[activeSlice] || 0
  if (current <= 0) return
  if (current <= api.selectedScrollSnap()) api.scrollPrev()
  setActiveEvents({ ...activeEvents, [activeSlice]: current - 1 })
}
export const handleArrowDown = (setActiveSlice: React.Dispatch<React.SetStateAction<number>>, dataSlice: Conference[], dataSliceHandlers: Handlers, data: RecentData, setIsLoading: React.Dispatch<React.SetStateAction<boolean>>, fetchMore: (offset: number) => Promise<void>) => {
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

export const handleArrowUp = (setActiveSlice: React.Dispatch<React.SetStateAction<number>>, dataSliceHandlers: Handlers, data: RecentData) => {
  setActiveSlice((activeSlice) => {
    if (activeSlice - 1 >= 0) {
      dataSliceHandlers.prepend(data.conferencesRecent[activeSlice - 1])
      return activeSlice - 1

    }
    return activeSlice
  })
  
}

