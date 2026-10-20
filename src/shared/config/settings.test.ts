import { expect, test, vi } from 'vitest';

test.each([
  ['spinnerStyle', 'loaderStyle', '"ring"', 'ring'],
  ['spinnerStyle', 'loaderStyle', '"unknown"', 'orbit'],
  ['subtitleColor', 'subtitleStyle', 'green', '#AAF40D'],
  ['previewVideo', 'previewVideo', '"off"', 'still'],
  ['themeMode', 'themeMode', 'dark', 'dark'],
  ['textScale', 'textScale', '1.5', 1.5],
  ['textScale', 'textScale', '"bad"', 1],
  ['uiFont', 'uiFont', '{}', 'default'],
] as const)('settings migrate and validate %s from %s', async (key, storedKey, raw, expected) => {
  vi.resetModules();
  localStorage.setItem(storedKey, raw);
  const { getSetting } = await import('./settings');
  expect(getSetting(key)).toBe(expected);
  localStorage.setItem(storedKey, '"changed"');
  expect(getSetting(key)).toBe(expected);
});

test('settings use defaults when storage is absent or denied', async () => {
  vi.resetModules();
  const settings = await import('./settings');
  expect(settings.getSetting('spinnerStyle')).toBe('orbit');
  expect(settings.getSetting('themeMode')).toBe('black');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied'); });
  expect(settings.getSetting('subtitleColor')).toBe('#AAF40D');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  settings.setSetting('uiFont', 'inter');
  expect(settings.getSetting('uiFont')).toBe('inter');
});
