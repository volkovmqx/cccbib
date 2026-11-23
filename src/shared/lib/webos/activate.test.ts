import { expect, test, vi } from 'vitest';
import { activateApp } from './activate';

test('the app is activated through webOSSystem, through PalmSystem on older TVs and not at all elsewhere', () => {
  const modern = vi.fn();
  const legacy = vi.fn();
  vi.stubGlobal('webOSSystem', { activate: modern });
  vi.stubGlobal('PalmSystem', { activate: legacy });
  activateApp();
  expect(modern).toHaveBeenCalledTimes(1);
  expect(legacy).not.toHaveBeenCalled();
  vi.stubGlobal('webOSSystem', undefined);
  activateApp();
  expect(legacy).toHaveBeenCalledTimes(1);
  vi.stubGlobal('PalmSystem', {});
  expect(() => activateApp()).not.toThrow();
  vi.stubGlobal('PalmSystem', undefined);
  expect(() => activateApp()).not.toThrow();
  vi.unstubAllGlobals();
});
