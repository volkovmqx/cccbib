import { expect, test, vi } from 'vitest';
import { handleArrowLeft, handleArrowRight } from './navigation';

test('without a carousel the arrow keys still move the selection inside the row data', () => {
  const set = vi.fn();
  handleArrowRight(undefined, { row: 2 }, 'row', set);
  expect(set).toHaveBeenLastCalledWith({ row: 3 });
  handleArrowLeft(undefined, { row: 2 }, 'row', set);
  expect(set).toHaveBeenLastCalledWith({ row: 1 });
});
