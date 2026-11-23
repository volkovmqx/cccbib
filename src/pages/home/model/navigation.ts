import type { CarouselApi } from './types';

type SetActiveEvents = React.Dispatch<React.SetStateAction<Record<string, number>>>;

export const handleArrowRight = (api: CarouselApi | undefined, activeEvents: Record<string, number>, rowKey: string, setActiveEvents: SetActiveEvents) => {
  const current = activeEvents[rowKey] || 0;
  if (api) {
    if (current >= api.slideNodes().length - 1) return;
    if (api.canScrollNext() && current >= api.selectedScrollSnap()) api.scrollNext();
  }
  setActiveEvents({ ...activeEvents, [rowKey]: current + 1 });
};

export const handleArrowLeft = (api: CarouselApi | undefined, activeEvents: Record<string, number>, rowKey: string, setActiveEvents: SetActiveEvents) => {
  const current = activeEvents[rowKey] || 0;
  if (current <= 0) return;
  if (api && current <= api.selectedScrollSnap()) api.scrollPrev();
  setActiveEvents({ ...activeEvents, [rowKey]: current - 1 });
};
