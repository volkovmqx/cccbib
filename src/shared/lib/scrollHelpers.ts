import { isPointerDriven } from './pointer';

export function scrollIntoView(selectedItemRef: React.RefObject<HTMLElement | null>, _containerRef: React.RefObject<HTMLElement | null> | null, block: ScrollLogicalPosition = 'nearest') {
  if (selectedItemRef.current && !isPointerDriven()) {
    selectedItemRef.current.scrollIntoView({
      behavior: 'smooth',
      block: block
    });
  }
}

const LOOKAHEAD_ITEMS = 1.5;

// With rows of different heights the margin has to follow the tallest row, otherwise the selection moves up the screen on a press that goes down
export function revealInList(item: HTMLElement | null, scroller?: HTMLElement | null, rowHeight?: number) {
  const list = scroller || item?.parentElement;
  if (!item || !list) return;
  const box = item.getBoundingClientRect();
  const height = rowHeight || box.height;
  const top = box.top - list.getBoundingClientRect().top + list.scrollTop;
  const lead = isPointerDriven() ? 0 : height * LOOKAHEAD_ITEMS;
  if (top - lead < list.scrollTop) list.scrollTop = Math.max(0, top - lead);
  else if (top + height + lead > list.scrollTop + list.clientHeight) list.scrollTop = top + height + lead - list.clientHeight;
}
