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
