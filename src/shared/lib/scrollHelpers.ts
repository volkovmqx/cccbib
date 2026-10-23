import { useEffect } from 'react';
import { isPointerDriven } from './pointer';

export function scrollIntoView(selectedItemRef: React.RefObject<HTMLElement | null>, _containerRef: React.RefObject<HTMLElement | null> | null, block: ScrollLogicalPosition = 'nearest') {
  if (selectedItemRef.current && !isPointerDriven()) {
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

const LOOKAHEAD_ITEMS = 1.5;

export function revealInList(item: HTMLElement | null) {
  const list = item?.parentElement;
  if (!item || !list) return;
  const box = item.getBoundingClientRect();
  const height = box.height;
  const top = box.top - list.getBoundingClientRect().top + list.scrollTop;
  const lead = isPointerDriven() ? 0 : height * LOOKAHEAD_ITEMS;
  if (top - lead < list.scrollTop) list.scrollTop = top - lead;
  else if (top + height + lead > list.scrollTop + list.clientHeight) list.scrollTop = top + height + lead - list.clientHeight;
}
