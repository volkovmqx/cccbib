import type { Conference } from '@/entities/conference';
import type { CarouselApi } from '../model/types';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { IconWorld, IconBadgeCc, IconAspectRatio } from '@tabler/icons-react';
import { pointerMoved, useImagePreload } from '@/shared/lib';
import { formatDuration, isOddAspect } from '@/entities/talk';
import { useSetting } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

type Lecture = Conference['lectures']['nodes'][number];
interface SlideMeta { hasMultipleLanguages: boolean; hasSubtitles?: boolean; oddAspect: boolean }
interface SlideProps {
  lecture: Lecture; index: number; meta: SlideMeta; selected: boolean; near: boolean; progress: number; showDescription: boolean; pictureOnly: boolean;
  t: ReturnType<typeof useTranslation>; onPointer: (event: React.MouseEvent, index: number) => void; onPick: (index: number) => void;
}

// A key press changes the selection of two slides of a row, so the others keep their markup
const Slide = React.memo(function Slide({ lecture: e, index, meta, selected, near, progress, showDescription, pictureOnly, t, onPointer, onPick }: SlideProps) {
  const { hasMultipleLanguages, hasSubtitles, oddAspect } = meta;
  return (
    <div
      className={selected ? 'embla__slide active' : 'embla__slide'}
      onMouseMove={(event) => onPointer(event, index)}
      onClick={pictureOnly ? undefined : () => onPick(index)}
    >
      <div className="embla__slide__media" onClick={pictureOnly ? () => onPick(index) : undefined}>
        <img
          className="embla__slide__img"
          src={near ? e.images.thumbUrl : undefined}
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
        {progress > 0 && (
          <div className="embla__slide__progress" aria-label={t('{percent}% watched', { percent: Math.round(progress) })}>
            <div
              className="embla__slide__progressFill"
              style={{ width: `${progress}%` }}
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
        {showDescription && e.description && <div className="embla__slide__description">{e.description}</div>}
      </div>
    </div>
  );
});

const SLIDE_REACH = 5;

export const EventCarousel = React.memo(function EventCarousel({
  eventApis,
  events,
  activeEvent,
  rowIndex,
  active = true,
  near = true,
  conferenceTitle,
  onOpenConference,
  playbackProgressByGuid,
  showDescription = false,
  pictureOnly = false,
  onHover,
  onOpen,
}: { eventApis: React.RefObject<CarouselApi[]>; events: Pick<Conference, 'lectures'>; activeEvent: number; rowIndex: number; active?: boolean; near?: boolean; conferenceTitle: string; onOpenConference?: () => void; playbackProgressByGuid?: Map<string, number>; showDescription?: boolean; pictureOnly?: boolean; onHover?: (row: number, index: number) => void; onOpen?: (row: number, index: number) => void }) {
    const t = useTranslation();
    const [language] = useSetting('language');
    // A slide the pointer chose stays put, scrolling to it would move the slides under the cursor
    const pointerIndex = useRef<number | null>(null);
    if (pointerIndex.current !== (activeEvent || 0)) pointerIndex.current = null;
    // Embla measures every slide again whenever its options change or a slide resizes, which costs a whole row on the TV
    const startIndex = useRef(activeEvent || 0);
    const options = useMemo(() => ({ align: 'start' as const, startIndex: startIndex.current, duration: 15, watchResize: false, watchSlides: false }), []);
    const [emblaRef, emblaApi] = useEmblaCarousel(options);

    const slideCount = events.lectures.nodes.length;
    const measuredCount = useRef(slideCount);
    useEffect(() => {
      if (!emblaApi || measuredCount.current === slideCount) return;
      measuredCount.current = slideCount;
      emblaApi.reInit();
    }, [emblaApi, slideCount]);
    useEffect(() => {
      if (!emblaApi) return undefined;
      let frame = 0;
      const measure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => emblaApi.reInit());
      };
      window.addEventListener('resize', measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', measure);
      };
    }, [emblaApi]);

    useEffect(() => {
      if (emblaApi) {
        eventApis.current[rowIndex] = emblaApi;
      }
    }, [emblaApi, rowIndex, eventApis]);

    useEffect(() => {
      if (pointerIndex.current === (activeEvent || 0)) return;
      if (emblaApi && emblaApi.selectedScrollSnap() !== (activeEvent || 0)) {
        emblaApi.scrollTo(activeEvent || 0, true);
      }
    }, [activeEvent, emblaApi, events.lectures.nodes]);

    // Preload adjacent carousel images for smoother navigation
    const imageUrls = useMemo(() =>
      near ? events.lectures.nodes.map(e => e.images?.thumbUrl).filter(Boolean) : [],
      [events.lectures.nodes, near]
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

    // Only the slides around the selection are built, a row can hold dozens and every slide costs the TV time on each key press
    // The others are empty slides of the same size, so the row keeps its length and its snap points
    const center = activeEvent || 0;

    const latest = useRef({ active, activeEvent: activeEvent || 0, rowIndex, onHover, onOpen });
    latest.current = { active, activeEvent: activeEvent || 0, rowIndex, onHover, onOpen };
    const pointSlide = useCallback((event: React.MouseEvent, ei: number) => {
      const { active: rowActive, activeEvent: current, rowIndex: row, onHover: hover } = latest.current;
      if (!hover || !pointerMoved(event) || (rowActive && ei === current)) return;
      if (ei !== current) pointerIndex.current = ei;
      hover(row, ei);
    }, []);
    const pickSlide = useCallback((ei: number) => {
      const { activeEvent: current, rowIndex: row, onOpen: open } = latest.current;
      if (!open) return;
      if (ei !== current) pointerIndex.current = ei;
      open(row, ei);
    }, []);

    return (
      <>
        {onOpenConference
          ? <h2 className="carouselTitle carouselTitle--link" role="link" onClick={onOpenConference}>{conferenceTitle}</h2>
          : <h2 className="carouselTitle">{conferenceTitle}</h2>}
        <div className="embla">
          <div className="embla__viewport" ref={emblaRef}>
            <div className="embla__container">
              {events.lectures.nodes.map((e, ei) => (Math.abs(ei - center) > SLIDE_REACH ? <div key={ei} className="embla__slide" /> : (
                <Slide
                  key={ei}
                  lecture={e}
                  index={ei}
                  meta={eventMetadata[ei]}
                  selected={active && center === ei}
                  near={near}
                  progress={playbackProgressByGuid?.get(e.guid) || 0}
                  showDescription={showDescription}
                  pictureOnly={pictureOnly}
                  t={t}
                  onPointer={pointSlide}
                  onPick={pickSlide}
                />
              )))}
            </div>
          </div>
        </div>
      </>
    );
  });
