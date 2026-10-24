import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { talk } from '../../../../tests/fixtures';
import Search from './Search';
import { searchLectures, getCachedSearch } from '../api/search';

vi.mock('../api/search', () => ({ normalizeQuery: (text: string) => text.trim().toLowerCase(), getCachedSearch: vi.fn(), searchLectures: vi.fn() }));
const callbacks = () => ({ onClose: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false, onSelectEvent: vi.fn() });
beforeEach(() => { vi.useFakeTimers(); vi.mocked(getCachedSearch).mockReturnValue(undefined); vi.mocked(searchLectures).mockResolvedValue([]); });

test('search debounces input, selects results, and moves focus with remote keys', async () => {
  const props = callbacks();
  const results = [talk(), talk({ guid: 'second', title: 'Second', images: {}, viewCount: 0, duration: 0, persons: [] })];
  vi.mocked(searchLectures).mockResolvedValue(results);
  const view = render(<Search {...props} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(input).toHaveFocus();
  fireEvent.keyDown(window, { key: 'ArrowDown' }); fireEvent.keyDown(window, { key: 'ArrowUp' });
  fireEvent.change(input, { target: { value: 'hello' } });
  expect(screen.getByRole('status')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(screen.getByText('Test talk')).toBeVisible();
  fireEvent.click(screen.getByText('Second'));
  expect(props.onSelectEvent).toHaveBeenCalledWith(results[1]);
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'Enter']) fireEvent.keyDown(window, { key });
  expect(props.onSelectEvent).toHaveBeenLastCalledWith(results[1]);
  input.focus(); input.setSelectionRange(3, 3);
  fireEvent.keyDown(window, { key: 'ArrowLeft' }); expect(props.onFocusSidebar).not.toHaveBeenCalled();
  input.setSelectionRange(0, 0); fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(props.onFocusSidebar).toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.keyDown(window, { keyCode: 461 });
  expect(props.onClose).toHaveBeenCalledTimes(2);
  view.rerender(<Search {...props} sidebarFocused />);
  fireEvent.keyDown(window, { key: 'Escape' }); expect(props.onClose).toHaveBeenCalledTimes(2);
});

test('search results follow a moving pointer and open on click', async () => {
  const props = callbacks();
  const results = [talk(), talk({ guid: 'second', title: 'Second', images: {} })];
  vi.mocked(searchLectures).mockResolvedValue(results);
  const view = render(<Search {...props} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  const second = screen.getByText('Second').closest('.listItem')!;
  fireEvent.mouseMove(second, { clientX: 41, clientY: 61 });
  expect(second).toHaveClass('listItem--selected');
  fireEvent.mouseMove(view.container.querySelector('.listItem')!, { clientX: 41, clientY: 61 });
  expect(second).toHaveClass('listItem--selected');
  fireEvent.click(second); expect(props.onSelectEvent).toHaveBeenCalledWith(results[1]);
});

test('search uses cached results and Enter submits without the debounce delay', async () => {
  const view = render(<Search {...callbacks()} />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'fresh' } });
  fireEvent.keyDown(window, { key: 'Enter' });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(searchLectures).toHaveBeenCalledWith('fresh', expect.any(AbortSignal));
  vi.mocked(getCachedSearch).mockReturnValue([talk()]);
  fireEvent.change(input, { target: { value: 'cached' } });
  expect(screen.getByText('Test talk')).toBeVisible();
  fireEvent.change(input, { target: { value: ' ' } });
  expect(view.container.querySelectorAll('.listItem')).toHaveLength(0);
});

test.each([new TypeError('network'), new Error('Failed search'), Object.assign(new Error(''), { name: 'Unknown' })])('search reports failures', async error => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(searchLectures).mockRejectedValue(error);
  const view = render(<Search {...callbacks()} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'failure' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(view.container.querySelector('.errorText')?.textContent).toBeTruthy();
});

test('search ignores aborted and obsolete requests', async () => {
  let resolve!: (value: ReturnType<typeof talk>[]) => void;
  vi.mocked(searchLectures).mockImplementation(() => new Promise(next => { resolve = next; }));
  const view = render(<Search {...callbacks()} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'obsolete' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
  await act(async () => { resolve([talk()]); });
  expect(view.container.querySelector('.listItem')).not.toBeInTheDocument();
  vi.mocked(searchLectures).mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'aborted' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(view.container.querySelector('.errorText')).not.toBeInTheDocument();
});

test('the left key leaves the results for the side menu even when the field is not focused', async () => {
  const props = callbacks();
  vi.mocked(searchLectures).mockResolvedValue([talk()]);
  render(<Search {...props} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'hello' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  input.blur();
  input.setSelectionRange(3, 3);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(props.onFocusSidebar).toHaveBeenCalledTimes(1);
});

test('the results follow the selection at once, also when it wraps around, instead of scrolling smoothly', async () => {
  const props = callbacks();
  const results = Array.from({ length: 12 }, (_, index) => talk({ guid: `r${index}`, title: `Result ${index}` }));
  vi.mocked(searchLectures).mockResolvedValue(results);
  const view = render(<Search {...props} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  const container = view.container.querySelector('.searchResults') as HTMLElement;
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
  container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  const rows = [...view.container.querySelectorAll('.listItem')] as HTMLElement[];
  rows.forEach((row, index) => { row.getBoundingClientRect = () => ({ top: 100 + index * 100 - container.scrollTop, height: 100 } as DOMRect); });
  const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
  for (let step = 0; step < 6; step += 1) fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(container.scrollTop).toBeGreaterThan(0);
  const before = container.scrollTop;
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(container.scrollTop).toBeGreaterThan(before);
  for (let step = 0; step < 5; step += 1) fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(rows[0]).toHaveClass('listItem--selected');
  expect(container.scrollTop).toBe(0);
  expect(scrollIntoView).not.toHaveBeenCalled();
});

test('with rows of different heights a key never moves the highlighted row against its direction on the screen', async () => {
  const props = callbacks();
  const results = Array.from({ length: 24 }, (_, index) => talk({ guid: `h${index}`, title: `Result ${index}` }));
  vi.mocked(searchLectures).mockResolvedValue(results);
  const view = render(<Search {...props} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  const container = view.container.querySelector('.searchResults') as HTMLElement;
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 960 });
  container.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
  const heights = results.map((_, index) => (index % 5 === 3 || index % 7 === 4 ? 225 : 154));
  const tops = heights.map((_, index) => heights.slice(0, index).reduce((sum, height) => sum + height + 10, 0));
  const rows = [...view.container.querySelectorAll('.listItem')] as HTMLElement[];
  rows.forEach((row, index) => { row.getBoundingClientRect = () => ({ top: tops[index] - container.scrollTop, height: heights[index] } as DOMRect); });
  const onScreen = (index: number) => tops[index] - container.scrollTop;
  const moved: number[] = [];
  for (let step = 1; step < 20; step += 1) {
    const before = onScreen(step - 1);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    moved.push(onScreen(step) - before);
  }
  expect(moved.every((delta) => delta >= 0)).toBe(true);
  moved.length = 0;
  for (let step = 19; step > 0; step -= 1) {
    const before = onScreen(step);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    moved.push(onScreen(step - 1) - before);
  }
  expect(moved.every((delta) => delta <= 0)).toBe(true);
});

