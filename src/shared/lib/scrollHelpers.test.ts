import { expect, test } from 'vitest';
import { pointerMoved } from './pointer';
import { revealInList } from './scrollHelpers';

const setup = () => {
  const list = document.createElement('div');
  const item = document.createElement('div');
  list.append(item);
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 400 });
  list.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  const place = (top: number) => { item.getBoundingClientRect = () => ({ top: 100 + top - list.scrollTop, height: 70 } as DOMRect); };
  return { list, item, place };
};

test('a popup list keeps the next items in view below the selection and the previous ones above it', () => {
  const { list, item, place } = setup();
  place(150); revealInList(item);
  expect(list.scrollTop).toBe(0);
  place(340); revealInList(item);
  expect(list.scrollTop).toBe(115);
  place(160); revealInList(item);
  expect(list.scrollTop).toBe(55);
  place(190); revealInList(item);
  expect(list.scrollTop).toBe(55);
  revealInList(null);
  revealInList(document.createElement('div'));
});

test('a selection that follows the pointer is only just brought into view', () => {
  const { list, item, place } = setup();
  pointerMoved({ nativeEvent: new Event('mousemove'), clientX: 9001, clientY: 9002 });
  place(340); revealInList(item);
  expect(list.scrollTop).toBe(10);
  place(4); revealInList(item);
  expect(list.scrollTop).toBe(4);
});
