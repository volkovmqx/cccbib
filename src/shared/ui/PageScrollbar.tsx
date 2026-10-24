import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { dragScrollbar } from '@/shared/lib';

const THUMB_MIN_PERCENT = 8;

// The bar runs along the right edge of the whole screen, the scroller it follows starts lower down
export const PageScrollbar = React.memo(function PageScrollbar({ scrollerRef, watch }: { scrollerRef: React.RefObject<HTMLElement | null>; watch: unknown }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);

  const update = useCallback(() => {
    const scroller = scrollerRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !thumb) return;
    const range = scroller.scrollHeight - scroller.clientHeight;
    // The grip keeps its size while it is held, rows that load meanwhile would shrink it under the pointer
    const height = draggingRef.current ? parseFloat(thumb.style.height) || 0 : range > 0 ? Math.max(THUMB_MIN_PERCENT, (scroller.clientHeight / scroller.scrollHeight) * 100) : 0;
    if (!draggingRef.current) thumb.style.height = `${height}%`;
    thumb.style.top = `${range > 0 ? (scroller.scrollTop / range) * (100 - height) : 0}%`;
  }, [scrollerRef]);

  useLayoutEffect(() => { update(); }, [watch, update]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [scrollerRef, update]);

  useEffect(() => () => releaseRef.current?.(), []);

  const onMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !bar || !thumb) return;
    releaseRef.current?.();
    draggingRef.current = true;
    releaseRef.current = dragScrollbar(event, scroller, bar, thumb, () => {
      draggingRef.current = false;
      update();
    });
  }, [scrollerRef, update]);

  return (
    <div className="pageScroll" aria-hidden="true" ref={barRef} onMouseDown={onMouseDown}>
      <div className="pageScroll__thumb" ref={thumbRef} />
    </div>
  );
});
