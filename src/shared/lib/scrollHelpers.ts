import { useEffect } from 'react';

export function scrollIntoView(selectedItemRef: React.RefObject<HTMLElement | null>, _containerRef: React.RefObject<HTMLElement | null> | null, block: ScrollLogicalPosition = 'nearest') {
  if (selectedItemRef.current) {
    selectedItemRef.current.scrollIntoView({
      behavior: 'smooth',
      block: block
    });
  }
}

export function useScrollIntoView(selectedItemRef: React.RefObject<HTMLElement | null>, containerRef: React.RefObject<HTMLElement | null> | null, deps: React.DependencyList | number, block: ScrollLogicalPosition = 'nearest') {
  const depArray = Array.isArray(deps) ? deps : [deps];

  useEffect(() => {
    scrollIntoView(selectedItemRef, containerRef, block);
  }, [...depArray, block]);
}
