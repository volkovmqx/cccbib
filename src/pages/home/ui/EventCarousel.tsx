import type { Conference } from '@/entities/conference';
import type { CarouselApi } from '../model/types';
import React, { useEffect, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { IconWorld, IconBadgeCc, IconAspectRatio } from '@tabler/icons-react';
import { useImagePreload } from '@/shared/lib';
import { formatDuration, isOddAspect } from '@/entities/talk';
import { useSetting } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

export const EventCarousel = React.memo(function EventCarousel({
  eventApis,
  events,
  activeEvent,
  ci,
  conferenceTitle,
  playbackProgressByGuid,
}: { eventApis: React.RefObject<CarouselApi[]>; events: Pick<Conference, 'lectures'>; activeEvent: number; ci: number; conferenceTitle: string; playbackProgressByGuid?: Map<string, number> }) {
    const t = useTranslation();
    const [language] = useSetting('language');
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', startIndex: activeEvent || 0, duration: 15 });

    useEffect(() => {
      if (emblaApi) {
        eventApis.current[ci] = emblaApi;
      }
    }, [emblaApi, ci, eventApis]);

    useEffect(() => {
      if (emblaApi && emblaApi.selectedScrollSnap() !== (activeEvent || 0)) {
        emblaApi.scrollTo(activeEvent || 0, true);
      }
    }, [activeEvent, emblaApi, events.lectures.nodes]);

    // Preload adjacent carousel images for smoother navigation
    const imageUrls = useMemo(() =>
      events.lectures.nodes.map(e => e.images?.thumbUrl).filter(Boolean),
      [events.lectures.nodes]
    );
    useImagePreload(imageUrls, activeEvent || 0, 5);

    const eventMetadata = useMemo(() => {
      return events.lectures.nodes.map(e => {
        const availableLanguages = [...new Set(
          e.videos
            .filter(v => v.mimeType === "video/webm" && v.url && v.language)
            .flatMap(v => v.language.split('-'))
        )];
        return {
          hasMultipleLanguages: availableLanguages.length > 1,
          hasSubtitles: e.subtitles && e.subtitles.length > 0,
          oddAspect: isOddAspect(e.videos, language)
        };
      });
    }, [events.lectures.nodes, language]);

    return (
      <>
        <h2 className="carouselTitle">{conferenceTitle}</h2>
        <div className="embla">
          <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container">
              {events.lectures.nodes.map((e, ei) => {
                const { hasMultipleLanguages, hasSubtitles, oddAspect } = eventMetadata[ei];
                const isActive = ci === 0 && (activeEvent || 0) === ei;
                const playbackProgress = playbackProgressByGuid?.get(e.guid) || 0;

                return (
                  <div className={isActive ? 'embla__slide active' : 'embla__slide'} key={ei}>
                    <div className="embla__slide__media">
                      <img
                        className="embla__slide__img"
                        src={e.images.thumbUrl}
                        loading="lazy"
                        decoding="async"
                        alt={e.title}
                      />
                      {(hasMultipleLanguages || hasSubtitles || oddAspect) && (
                        <div className="embla__slide__icons">
                          {oddAspect && <IconAspectRatio className={`slide-icon${hasMultipleLanguages || hasSubtitles ? ' slide-icon--mr' : ''}`} stroke={1.75} />}
                          {hasMultipleLanguages && <IconWorld className={`slide-icon${hasSubtitles ? ' slide-icon--mr' : ''}`} stroke={1.75} />}
                          {hasSubtitles && <IconBadgeCc className="slide-icon" stroke={1.75} />}
                        </div>
                      )}
                      {playbackProgress > 0 && (
                        <div className="embla__slide__progress" aria-label={t('{percent}% watched', { percent: Math.round(playbackProgress) })}>
                          <div
                            className="embla__slide__progressFill"
                            style={{ width: `${playbackProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="embla__slide__text">
                      <div className="embla__slide__title">{e.title}</div>
                      <div className="embla__slide__meta">
                        {formatDuration(e.duration)}
                        {e.persons && e.persons.length > 0 ? ` \u2022 ${e.persons.join(', ')}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  });
