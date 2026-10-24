import { isWebOS } from './platform';

type LockableOrientation = ScreenOrientation & { lock?: (type: string) => Promise<void> };

// Input decides, not the width: a narrow desktop window and the TV do not count
const isPhoneOrTablet = () => !isWebOS()
  && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches
  && navigator.maxTouchPoints > 0;

const ignore = () => {};

// Landscape while a talk plays on a phone or tablet. A device that is already held sideways stays as it is, and letting go gives the orientation back to the device
export function lockLandscape(): () => void {
  const orientation = typeof screen !== 'undefined' ? screen.orientation as LockableOrientation | undefined : undefined;
  if (!orientation || typeof orientation.lock !== 'function' || !isPhoneOrTablet()) return ignore;
  const lock = orientation.lock.bind(orientation);
  const target = orientation.type.startsWith('landscape') ? orientation.type : 'landscape';
  const root = document.documentElement;
  let released = false;
  let enteredFullscreen = false;

  const leaveFullscreen = () => {
    if (!enteredFullscreen) return;
    enteredFullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(ignore);
  };

  (async () => {
    try {
      await lock(target);
      return;
    } catch (error) {
      // A browser tab may only lock while it is fullscreen
      if ((error as Error).name !== 'SecurityError' || released || document.fullscreenElement || !root.requestFullscreen) return;
    }
    try {
      await root.requestFullscreen();
      enteredFullscreen = true;
      if (released) return leaveFullscreen();
      await lock(target);
    } catch {
      leaveFullscreen();
    }
  })();

  return () => {
    released = true;
    try { orientation.unlock(); } catch { /* nothing was locked */ }
    leaveFullscreen();
  };
}
