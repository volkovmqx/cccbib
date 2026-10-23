import { expect, test, vi } from 'vitest';

test.each([
  ['spinnerStyle', 'loaderStyle', '"ring"', 'ring'],
  ['spinnerStyle', 'loaderStyle', '"unknown"', 'orbit'],
  ['subtitleColor', 'subtitleStyle', 'green', '#AAF40D'],
  ['logoButton', 'settingsEntry', '"logo"', 'settings'],
  ['logoButton', 'settingsEntry', '"icon"', 'off'],
  ['logoButton', 'settingsEntry', '"other"', 'off'],
  ['logoButton', 'logoButton', '"home"', 'home'],
  ['previewImage', 'previewVideo', '"mute"', 'on'],
  ['previewImage', 'previewVideo', '"still"', 'on'],
  ['previewImage', 'previewVideo', '"off"', 'on'],
  ['previewImage', 'previewVideo', '"none"', 'none'],
  ['previewImage', 'previewImage', '"none"', 'none'],
  ['previewImage', 'previewVideo', '"bogus"', 'on'],
  ['themeMode', 'themeMode', 'dark', 'dark'],
  ['textScale', 'textScale', '1.5', 1.2],
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

test('text and icon sizes saved before the larger normal size keep their look once and later values are left alone', async () => {
  const load = async (stored: Record<string, string>) => {
    vi.resetModules(); localStorage.clear();
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    return import('./settings');
  };
  let settings = await load({ textScale: '1.2', iconScale: '1.1' });
  expect(settings.getSetting('textScale')).toBe(1);
  expect(settings.getSetting('iconScale')).toBe(1);
  expect(localStorage.getItem('scaleBase')).toBe('1');
  settings = await load({ textScale: '1.3', iconScale: '1', scaleBase: '1' });
  expect(settings.getSetting('textScale')).toBe(1.3);
  expect(settings.getSetting('iconScale')).toBe(1);
  settings = await load({ textScale: '1.3', iconScale: '1' });
  expect([settings.getSetting('textScale'), settings.getSetting('iconScale')]).toEqual([1.1, 0.9]);
  settings = await load({});
  expect([settings.getSetting('textScale'), settings.getSetting('iconScale')]).toEqual([1, 1]);
  settings = await load({ textScale: '"bad"', iconScale: 'null' });
  expect([settings.getSetting('textScale'), settings.getSetting('iconScale')]).toEqual([1, 1]);
  vi.resetModules(); localStorage.clear(); localStorage.setItem('textScale', '1.2');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied'); });
  expect((await import('./settings')).getSetting('textScale')).toBe(1.2);
});

