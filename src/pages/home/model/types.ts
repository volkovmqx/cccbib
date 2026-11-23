import type { UseEmblaCarouselType } from 'embla-carousel-react';
import type { Conference } from '@/entities/conference';
import type { Talk } from '@/entities/talk';

export type CarouselApi = NonNullable<UseEmblaCarouselType[1]>;
export interface TalkSelection { event: Talk; conferenceTitle: string }
export interface HomeRow {
  key: string;
  title: string;
  conferenceId?: string;
  events: Pick<Conference, 'lectures'>;
  conferenceTitleAt: (index: number) => string;
}
