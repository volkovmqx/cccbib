import type { UseEmblaCarouselType } from 'embla-carousel-react';
import type { Talk } from '@/entities/talk';

export type CarouselApi = NonNullable<UseEmblaCarouselType[1]>;
export interface TalkSelection { event: Talk; conferenceTitle: string }
