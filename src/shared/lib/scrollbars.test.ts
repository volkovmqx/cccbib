import { expect, test, vi } from 'vitest';
import { dragScrollbar, initScrollbars } from './scrollbars';

test('a scrolling list is marked until it stops, and the mark follows each list on its own', () => {
  vi.useFakeTimers();
  const stop = initScrollbars();
  const list = document.createElement('div');
  const other = document.createElement('div');
  document.body.append(list, other);
  list.dispatchEvent(new Event('scroll'));
  expect(list).toHaveAttribute('data-scrolling');
  expect(other).not.toHaveAttribute('data-scrolling');
  vi.advanceTimersByTime(600);
  list.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(600);
  expect(list).toHaveAttribute('data-scrolling');
  vi.advanceTimersByTime(400);
  expect(list).not.toHaveAttribute('data-scrolling');
  document.dispatchEvent(new Event('scroll'));
  expect(document.documentElement).toHaveAttribute('data-scrolling');
  other.dispatchEvent(new Event('scroll'));
  stop();
  expect(document.documentElement).not.toHaveAttribute('data-scrolling');
  expect(other).not.toHaveAttribute('data-scrolling');
  list.dispatchEvent(new Event('scroll'));
  expect(list).not.toHaveAttribute('data-scrolling');
  list.remove();
  other.remove();
});

const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 10, width: 10, height, x: 0, y: top, toJSON: () => ({}) });
const bar = (scrollHeight: number, clientHeight: number) => {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: clientHeight });
  const track = document.createElement('div');
  track.getBoundingClientRect = () => rect(0, 1000);
  const thumb = document.createElement('div');
  thumb.getBoundingClientRect = () => rect(0, 100);
  return { scroller, track, thumb };
};
const press = (clientY: number) => ({ clientY, preventDefault: vi.fn() });

test('dragging the thumb of a custom bar scrolls the page in proportion until the pointer is released', () => {
  const { scroller, track, thumb } = bar(2000, 1000);
  const event = press(50);
  const release = dragScrollbar(event, scroller, track, thumb);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(scroller.scrollTop).toBe(0);
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 500 }));
  expect(scroller.scrollTop).toBeCloseTo(500);
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 5000 }));
  expect(scroller.scrollTop).toBe(1000);
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: -300 }));
  expect(scroller.scrollTop).toBe(0);
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 950 }));
  expect(scroller.scrollTop).toBeCloseTo(1000);
  window.dispatchEvent(new MouseEvent('mouseup'));
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100 }));
  expect(scroller.scrollTop).toBeCloseTo(1000);
  release();
});

test('a press on the track puts the thumb under the pointer, and a page that cannot scroll ignores the bar', () => {
  const { scroller, track, thumb } = bar(2000, 1000);
  const release = dragScrollbar(press(450), scroller, track, thumb);
  expect(scroller.scrollTop).toBeCloseTo((400 / 900) * 1000);
  release();
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 900 }));
  expect(scroller.scrollTop).toBeCloseTo((400 / 900) * 1000);
  const fixed = bar(1000, 1000);
  const event = press(10);
  dragScrollbar(event, fixed.scroller, fixed.track, fixed.thumb)();
  expect(event.preventDefault).not.toHaveBeenCalled();
});

test('a burst of scroll events marks the list once and still hides the mark after the last one', () => {
  vi.useFakeTimers();
  const stop = initScrollbars();
  const list = document.createElement('div');
  document.body.append(list);
  const write = vi.spyOn(list, 'setAttribute');
  for (let frame = 0; frame < 10; frame += 1) { list.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(16); }
  expect(write).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(900);
  expect(list).not.toHaveAttribute('data-scrolling');
  stop();
});

test('while the thumb is held the distance to scroll is read again, so rows that load meanwhile are reached, and the end is reported', () => {
  const { scroller, track, thumb } = bar(2000, 1000);
  const ended = vi.fn();
  dragScrollbar(press(50), scroller, track, thumb, ended);
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 950 }));
  expect(scroller.scrollTop).toBeCloseTo(1000);
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 4000 });
  window.dispatchEvent(new MouseEvent('mousemove', { clientY: 950 }));
  expect(scroller.scrollTop).toBeCloseTo(3000);
  expect(ended).not.toHaveBeenCalled();
  window.dispatchEvent(new MouseEvent('mouseup'));
  expect(ended).toHaveBeenCalledTimes(1);
});
