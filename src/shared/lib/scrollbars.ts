const HIDE_MS = 900;

export function initScrollbars() {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const onScroll = (event: Event) => {
    const target = event.target instanceof Element ? event.target : document.documentElement;
    const pending = timers.get(target);
    if (pending === undefined) target.setAttribute('data-scrolling', '');
    else clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      target.removeAttribute('data-scrolling');
      timers.delete(target);
    }, HIDE_MS));
  };
  document.addEventListener('scroll', onScroll, true);
  return () => {
    document.removeEventListener('scroll', onScroll, true);
    timers.forEach((timer, target) => {
      clearTimeout(timer);
      target.removeAttribute('data-scrolling');
    });
    timers.clear();
  };
}

export function dragScrollbar(event: { clientY: number; preventDefault: () => void }, scroller: HTMLElement, bar: HTMLElement, thumb: HTMLElement, onEnd?: () => void) {
  const track = bar.getBoundingClientRect();
  const grip = thumb.getBoundingClientRect();
  const travel = track.height - grip.height;
  if (scroller.scrollHeight - scroller.clientHeight <= 0 || travel <= 0) return () => {};
  event.preventDefault();
  const offset = event.clientY >= grip.top && event.clientY <= grip.bottom ? event.clientY - grip.top : grip.height / 2;
  // Rows can load while the grip is held, so the distance to scroll is read again on every move
  const follow = (clientY: number) => {
    const range = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = (Math.min(Math.max(clientY - track.top - offset, 0), travel) / travel) * range;
  };
  const move = (moved: MouseEvent) => follow(moved.clientY);
  const release = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', release);
    if (onEnd) onEnd();
  };
  follow(event.clientY);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', release);
  return release;
}
