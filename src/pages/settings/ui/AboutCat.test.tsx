import { act, fireEvent, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AboutCat } from './AboutCat';

test('the cat waits for a quiet moment before it moves and rests on every input', () => {
  vi.useFakeTimers();
  const view = render(<AboutCat />);
  const cat = view.container.querySelector('.settingsView__cat')!;
  expect(cat).not.toHaveAttribute('data-moving');
  act(() => { vi.advanceTimersByTime(1200); });
  expect(cat).toHaveAttribute('data-moving');
  for (const input of [() => fireEvent.keyDown(window, { key: 'ArrowDown' }), () => fireEvent.mouseMove(window), () => fireEvent.mouseDown(window), () => fireEvent.wheel(window)]) {
    act(() => { input(); });
    expect(cat).not.toHaveAttribute('data-moving');
    act(() => { vi.advanceTimersByTime(1199); });
    expect(cat).not.toHaveAttribute('data-moving');
    act(() => { vi.advanceTimersByTime(1); });
    expect(cat).toHaveAttribute('data-moving');
  }
  act(() => { fireEvent.keyDown(window, { key: 'ArrowDown' }); });
  view.unmount();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(cat).not.toHaveAttribute('data-moving');
});
