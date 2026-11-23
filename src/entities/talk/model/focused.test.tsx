import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { talk } from '../../../../tests/fixtures';
import { readFocusedTalk, useFocusedTalk } from './focused';

test('the talk under the remote is kept while it is enabled and given up when it changes, is disabled or the screen goes', () => {
  expect(readFocusedTalk()).toBeNull();
  const first = talk({ guid: 'first' }); const second = talk({ guid: 'second' });
  const view = renderHook(({ item, enabled }) => useFocusedTalk(item, enabled), { initialProps: { item: first as ReturnType<typeof talk> | undefined, enabled: true } });
  expect(readFocusedTalk()).toBe(first);
  view.rerender({ item: second, enabled: true });
  expect(readFocusedTalk()).toBe(second);
  view.rerender({ item: second, enabled: false });
  expect(readFocusedTalk()).toBeNull();
  view.rerender({ item: second, enabled: true });
  view.rerender({ item: undefined, enabled: true });
  expect(readFocusedTalk()).toBeNull();
  view.rerender({ item: first, enabled: true });
  view.unmount();
  expect(readFocusedTalk()).toBeNull();
});

test('a screen that is left does not clear the talk another screen has already taken', () => {
  const left = talk({ guid: 'left' }); const entered = talk({ guid: 'entered' });
  const leaving = renderHook(() => useFocusedTalk(left, true));
  const entering = renderHook(() => useFocusedTalk(entered, true));
  leaving.unmount();
  expect(readFocusedTalk()).toBe(entered);
  entering.unmount();
  expect(readFocusedTalk()).toBeNull();
});
