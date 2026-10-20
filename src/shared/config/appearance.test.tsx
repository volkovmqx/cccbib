import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SETTING_DEFAULTS, THEME_MODES, BUTTON_STYLES, CORNER_STYLES, UI_FONTS } from './constants';
import { buttonColors, computeAppearance, initAppearance, paletteFor } from './appearance';
import { getSetting, setSetting, subscribeSettings, useSetting } from './settings';
import type { Settings } from './settings';

beforeEach(() => {
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Settings)[]) setSetting(key, SETTING_DEFAULTS[key]);
});

test('appearance defines colors, fonts, and geometry for every supported theme', () => {
  for (const theme of [...THEME_MODES.map(x => x.code), 'unknown']) {
    for (const accent of ['#AAF40D', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#777777', '#112233', 'bad']) {
      for (const style of BUTTON_STYLES.map(x => x.code)) {
        const appearance = computeAppearance({ ...SETTING_DEFAULTS, themeMode: theme, accentColor: accent, buttonStyle: style });
        expect(appearance.attrs['data-theme']).toBe(theme);
        expect(appearance.vars['--accent']).toMatch(/^#[0-9a-f]{6}$/);
        expect(appearance.vars['--btn-bg']).toMatch(/^#[0-9a-f]{6}$/);
        expect(appearance.vars['--btn-fg']).toMatch(/^#[0-9a-f]{6}$/);
        expect(Object.values(appearance.vars).every(value => typeof value === 'string')).toBe(true);
      }
    }
  }
  expect(paletteFor('unknown', '#fff')).toEqual(paletteFor('black', '#fff'));
  expect(buttonColors('inverted', '#AAF40D', paletteFor('black', '#AAF40D'))).toEqual(['#ffffff', '#000000']);
});

test('appearance applies font, subtitle, and corner settings', () => {
  for (const font of [...UI_FONTS.map(x => x.code), 'unknown']) {
    for (const color of ['accent', '#000000', '#ffffff']) {
      for (const background of ['auto', 'light', 'dark', 'outline', 'none']) {
        const result = computeAppearance({ ...SETTING_DEFAULTS, uiFont: font, subtitleFont: font, subtitleColor: color, subtitleBackground: background, textScale: 1.5 });
        expect(result.vars['--sub-font']).toBeTruthy();
        expect(result.attrs['data-text-large']).toBe('true');
        expect(result.vars['--sub-shadow'] === 'none').toBe(background !== 'outline');
      }
    }
  }
  for (const corner of [...CORNER_STYLES.map(x => x.code), 'unknown']) {
    const result = computeAppearance({ ...SETTING_DEFAULTS, cornerStyle: corner, menuIconColor: 'unknown', menuActiveColor: 'black' });
    expect(result.vars['--border-radius-sm']).toMatch(/^\d+px$/);
    expect(result.vars['--menu-active']).toBe('#000000');
  }
});

test('appearance applies CSS and caches boot state when relevant settings change', () => {
  initAppearance();
  expect(document.documentElement.getAttribute('data-theme')).toBe('black');
  setSetting('themeMode', 'light');
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#f4f5f7');
  const before = localStorage.getItem('appearance_boot');
  setSetting('remoteControl', 'on');
  expect(localStorage.getItem('appearance_boot')).toBe(before);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full'); });
  expect(() => setSetting('accentColor', '#000000')).not.toThrow();
});

test('settings subscriptions and hooks only notify the selected setting', () => {
  const listener = vi.fn();
  const unsubscribe = subscribeSettings(listener);
  const { result, rerender, unmount } = renderHook(({ name }) => useSetting(name), { initialProps: { name: 'themeMode' as 'themeMode' | 'uiFont' } });
  act(() => { result.current[1]('dark'); });
  expect(result.current[0]).toBe('dark');
  expect(JSON.parse(localStorage.getItem('themeMode')!)).toBe('dark');
  act(() => { setSetting('uiFont', 'inter'); });
  expect(result.current[0]).toBe('dark');
  rerender({ name: 'uiFont' });
  expect(result.current[0]).toBe('inter');
  expect(listener).toHaveBeenCalledWith('themeMode');
  unsubscribe();
  unmount();
  expect(getSetting('themeMode')).toBe('dark');
});
