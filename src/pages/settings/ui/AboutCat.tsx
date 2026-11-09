import { useEffect, useRef } from 'react';
import { voctocat } from '@/shared/branding';

const QUIET_MS = 1200;
const INPUT_EVENTS = ['keydown', 'mousemove', 'mousedown', 'wheel'];

export const AboutCat = () => {
  const cat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = cat.current;
    if (!element) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rest = () => {
      if (element.hasAttribute('data-moving')) element.removeAttribute('data-moving');
      clearTimeout(timer);
      timer = setTimeout(() => element.setAttribute('data-moving', ''), QUIET_MS);
    };
    rest();
    INPUT_EVENTS.forEach((name) => window.addEventListener(name, rest, true));
    return () => {
      clearTimeout(timer);
      INPUT_EVENTS.forEach((name) => window.removeEventListener(name, rest, true));
    };
  }, []);

  return <div ref={cat} className="settingsView__cat loading-spinner loading-spinner--inline loader-voctocat" aria-hidden="true" dangerouslySetInnerHTML={{ __html: voctocat }} />;
};
