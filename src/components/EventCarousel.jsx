import React, { useEffect, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Title } from '@mantine/core';
import { IconWorld, IconBadgeCc } from '@tabler/icons-react';
import { useImagePreload } from '../hooks/useImagePreload';

export const EventCarousel = React.memo(function EventCarousel({ eventApis, eventRefs, events, activeEvent, ci, conferenceTitle }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', startIndex: activeEvent || 0 });

    useEffect(() => {
      if (emblaRef && emblaApi) {
        eventRefs.current[ci] = emblaRef;
        eventApis.current[ci] = emblaApi;
      }
    }, [emblaRef, emblaApi, ci, eventRefs, eventApis]);

    // Preload adjacent carousel images for smoother navigation
    const imageUrls = useMemo(() =>
      events.lectures.nodes.map(e => e.images?.thumbUrl).filter(Boolean),
      [events.lectures.nodes]
    );
    useImagePreload(imageUrls, activeEvent || 0, 3);

    const eventMetadata = useMemo(() => {
      return events.lectures.nodes.map(e => {
        const availableLanguages = [...new Set(
          e.videos
            .filter(v => v.mimeType === "video/webm" && v.url && v.language)
            .flatMap(v => v.language.split('-'))
        )];
        return {
          hasMultipleLanguages: availableLanguages.length > 1,
          hasSubtitles: e.subtitles && e.subtitles.length > 0
        };
      });
    }, [events.lectures.nodes]);

    return (
      <>
        <Title size="48px" mb={20}>{conferenceTitle}</Title>
        <div className="embla">
          <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container">
              {events.lectures.nodes.map((e, ei) => {
                const { hasMultipleLanguages, hasSubtitles } = eventMetadata[ei];
                const isActive = ci === 0 && (activeEvent || 0) === ei;

                return (
                  <div className={isActive ? 'embla__slide active' : 'embla__slide'} key={ei}>
                    <img
                      className="embla__slide__img"
                      src={e.images.thumbUrl}
                      loading="lazy"
                      alt={e.title}
                    />
                    {(hasMultipleLanguages || hasSubtitles) && (
                      <div className="embla__slide__icons">
                        {hasMultipleLanguages && <IconWorld className="slide-icon slide-icon--mr" stroke={1.5} />}
                        {hasSubtitles && <IconBadgeCc className="slide-icon" stroke={1.5} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  });