import { useEffect, useRef } from 'react';

const WHEEL_STEP_MS = 120;
const RESCAN_MS = 100;
const RESCAN_END_MS = 220;
const LINE_PX = 40;
let lastX = -1;
let lastY = -1;
let lastEvent: Event | null = null;
let lastMoved = false;
let rescanEvent: Event | null = null;
let pointerDriven = false;
let keyResetAttached = false;

function markPointerDriven() {
  pointerDriven = true;
  if (keyResetAttached) return;
  keyResetAttached = true;
  window.addEventListener('keydown', () => { pointerDriven = false; }, true);
}

export const isPointerDriven = () => pointerDriven;

// Chrome repeats mousemove when content scrolls under a resting cursor
export function pointerMoved(event: { nativeEvent: Event; clientX: number; clientY: number }) {
  if (event.nativeEvent === lastEvent) return lastMoved;
  lastEvent = event.nativeEvent;
  lastMoved = event.nativeEvent === rescanEvent || event.clientX !== lastX || event.clientY !== lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  if (lastMoved) markPointerDriven();
  return lastMoved;
}

function rescanPointer() {
  const element = lastX >= 0 ? document.elementFromPoint(lastX, lastY) : null;
  if (!element) return;
  rescanEvent = new MouseEvent('mousemove', { bubbles: true, clientX: lastX, clientY: lastY });
  element.dispatchEvent(rescanEvent);
}

// Regions marked data-wheel scroll natively under the wheel, elsewhere it acts as the up and down keys
export function useWheelNavigation(openMenu?: () => boolean) {
  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  useEffect(() => {
    let lastStep = 0;
    let rescanTimer: ReturnType<typeof setTimeout> | undefined;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const inPlayer = Boolean(target && target.closest('.player-wrapper') && !target.closest('.picker'));
      if (!event.deltaY || inPlayer) return;
      const inRegion = Boolean(target && target.closest('[data-wheel="scroll"]'));
      const picker = target ? target.closest('.picker') : null;
      const main = inRegion || !target || target.closest('.appShell__nav') ? null : picker ? picker.querySelector<HTMLElement>('[data-wheel="scroll"]') : document.querySelector<HTMLElement>('[data-wheel-main]');
      if (inRegion || main) {
        if (main) {
          event.preventDefault();
          main.scrollTop += event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaY;
        }
        if (!rescanTimer) rescanTimer = setTimeout(() => { rescanTimer = undefined; rescanPointer(); }, RESCAN_MS);
        clearTimeout(endTimer);
        endTimer = setTimeout(rescanPointer, RESCAN_END_MS);
        return;
      }
      event.preventDefault();
      const now = Date.now();
      if (now - lastStep < WHEEL_STEP_MS) return;
      lastStep = now;
      if (target && target.closest('.appShell__nav') && openMenuRef.current && openMenuRef.current()) return;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: event.deltaY > 0 ? 'ArrowDown' : 'ArrowUp', bubbles: true, cancelable: true }));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      clearTimeout(rescanTimer);
      clearTimeout(endTimer);
    };
  }, []);
}
