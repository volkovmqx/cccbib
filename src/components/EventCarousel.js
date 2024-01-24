import React, { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react'
import { Title } from '@mantine/core';

export function EventCarousel({ eventApis, eventRefs, events, activeEvent, ci, conferenceTitle }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({align: 'start',  startIndex: activeEvent || 0});
    useEffect(() => {
      if (emblaRef && emblaApi) {
        eventRefs.current[ci] = emblaRef;
        eventApis.current[ci] = emblaApi;
      }
    }, [emblaRef, emblaApi]);
  
    return (
      <>
      <Title size={"48px"} mb={20}>{conferenceTitle}</Title>
      <div className="embla">
        <div className="embla__viewport" ref={emblaRef}>
          <div className="embla__container">
            {events.lectures.nodes.map((e, ei) => (
              <div className={ci === 0 && (activeEvent || 0) === ei ? 'embla__slide active' : 'embla__slide'} key={ei}>
                <img
                  className="embla__slide__img"
                  src={e.images.thumbUrl}
                  loading="lazy"
                  alt={e.title}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
    )
  }