import { useEffect } from 'react';

export function scrollIntoView(selectedItemRef, containerRef, block = 'nearest') {
  if (selectedItemRef.current) {
    selectedItemRef.current.scrollIntoView({
      behavior: 'smooth',
      block: block
    });
  }
}

export function useScrollIntoView(selectedItemRef, containerRef, deps, block = 'nearest') {
  const depArray = Array.isArray(deps) ? deps : [deps];

  useEffect(() => {
    scrollIntoView(selectedItemRef, containerRef, block);
  }, [...depArray, block]);
}

export function isDevelopment() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}
