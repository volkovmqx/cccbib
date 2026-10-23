import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SETTING_DEFAULTS, MENU_POSITIONS, THEME_MODES, ACCENT_COLORS, MENU_COLORS, NAV_INDICATORS, BUTTON_STYLES, BORDER_WIDTHS, CORNER_STYLES, UI_FONTS } from './constants';
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
        const channels = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ');
        expect(appearance.vars['--btn-fg-rgb']).toBe(channels(appearance.vars['--btn-fg']));
        expect(appearance.vars['--btn-bg-rgb']).toBe(channels(appearance.vars['--btn-bg']));
        expect(Object.values(appearance.vars).every(value => typeof value === 'string')).toBe(true);
      }
    }
  }
  expect(paletteFor('unknown', '#fff')).toEqual(paletteFor('black', '#fff'));
  expect(buttonColors('inverted', '#AAF40D', paletteFor('black', '#AAF40D'))).toEqual(['#ffffff', '#000000']);
});

test('the themed subtitle box takes the surface colour of the current theme', () => {
  for (const themeMode of THEME_MODES.map(x => x.code)) {
    const { surface } = paletteFor(themeMode, SETTING_DEFAULTS.accentColor);
    const channels = [1, 3, 5].map(start => parseInt(surface.slice(start, start + 2), 16)).join(', ');
    expect(computeAppearance({ ...SETTING_DEFAULTS, themeMode, subtitleBackground: 'theme' }).vars['--sub-bg'], themeMode).toBe(`rgba(${channels}, 0.9)`);
  }
  expect(computeAppearance({ ...SETTING_DEFAULTS, subtitleBackground: 'dark' }).vars['--sub-bg']).toBe('rgba(0, 0, 0, 0.8)');
});

test('appearance applies font, subtitle, and corner settings', () => {
  for (const font of [...UI_FONTS.map(x => x.code), 'unknown']) {
    for (const color of ['accent', '#000000', '#ffffff']) {
      for (const background of ['auto', 'light', 'dark', 'theme', 'outline', 'none']) {
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

const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => (Math.max(lightness(a), lightness(b)) + 0.05) / (Math.min(lightness(a), lightness(b)) + 0.05);

test('appearance passes the menu position to CSS', () => {
  expect(SETTING_DEFAULTS.menuPosition).toBe('top');
  for (const position of MENU_POSITIONS.map(x => x.code)) expect(computeAppearance({ ...SETTING_DEFAULTS, menuPosition: position }).attrs['data-menu-position']).toBe(position);
});

test('appearance passes the side menu indicator style to CSS', () => {
  expect(SETTING_DEFAULTS.navIndicator).toBe('line');
  for (const indicator of NAV_INDICATORS.map(x => x.code)) {
    expect(computeAppearance({ ...SETTING_DEFAULTS, navIndicator: indicator }).attrs['data-nav-indicator']).toBe(indicator);
  }
});

test('the contrast indicator is white or black with an accent icon and the accent otherwise, and always readable', () => {
  const dark = computeAppearance({ ...SETTING_DEFAULTS, themeMode: 'black', menuActiveColor: 'accent' }).vars;
  expect(dark['--nav-fill']).toBe('#ffffff');
  const light = computeAppearance({ ...SETTING_DEFAULTS, themeMode: 'light', menuActiveColor: 'accent' }).vars;
  expect(light['--nav-fill']).toBe(paletteFor('light', SETTING_DEFAULTS.accentColor).text);
  expect(computeAppearance({ ...SETTING_DEFAULTS, menuActiveColor: 'grey' }).vars['--nav-fill']).toBe('#aaf40d');
  for (const themeMode of THEME_MODES.map(x => x.code)) {
    for (const accentColor of ACCENT_COLORS.map(x => x.code)) {
      for (const menuActiveColor of MENU_COLORS.map(x => x.code)) {
        const vars = computeAppearance({ ...SETTING_DEFAULTS, themeMode, accentColor, menuActiveColor }).vars;
        expect(contrast(vars['--nav-fill-fg'], vars['--nav-fill']), `${themeMode} ${accentColor} ${menuActiveColor}`).toBeGreaterThanOrEqual(3);
      }
    }
  }
});

test('every palette keeps its text readable on the background and the new themes on their surfaces too', () => {
  for (const theme of THEME_MODES.map(x => x.code)) {
    const palette = paletteFor(theme, SETTING_DEFAULTS.accentColor);
    expect(contrast(palette.text, palette.bg), theme).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.muted, palette.bg), theme).toBeGreaterThanOrEqual(4.5);
  }
  for (const theme of ['ember', 'sunset', 'frost', 'paper', 'nocturne', 'abyss', 'cyberpunk', 'terminal', 'chicago']) {
    const palette = paletteFor(theme, SETTING_DEFAULTS.accentColor);
    expect(contrast(palette.dim, palette.bg), theme).toBeGreaterThanOrEqual(3);
    for (const surface of [palette.surface, palette.surfaceAlt, palette.surfaceHover]) {
      expect(contrast(palette.text, surface), theme).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.muted, surface), theme).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('the light themes get the light gloss and the glow themes get a canvas', () => {
  const read = (themeMode: string) => computeAppearance({ ...SETTING_DEFAULTS, themeMode });
  for (const theme of ['light', 'lighttinted', 'frost', 'paper', 'chicago']) expect(read(theme).vars['--gloss'], theme).toBe('rgba(255, 255, 255, 0.6)');
  for (const theme of ['black', 'dark', 'tinted', 'ambient', 'ember', 'sunset', 'nocturne', 'abyss', 'cyberpunk', 'terminal']) expect(read(theme).vars['--gloss'], theme).toBe('rgba(255, 255, 255, 0.14)');
  for (const theme of ['ambient', 'ember', 'sunset', 'frost', 'paper', 'nocturne', 'abyss', 'cyberpunk', 'terminal', 'chicago']) expect(read(theme).attrs['data-canvas'], theme).toBe('glow');
  for (const theme of ['black', 'dark', 'light', 'tinted', 'lighttinted', 'unknown']) expect(read(theme).attrs['data-canvas'], theme).toBe('none');
});

test('the accent stroke of the indicator stands out from the menu for every theme and accent', () => {
  for (const themeMode of THEME_MODES.map(x => x.code)) {
    for (const accentColor of ACCENT_COLORS.map(x => x.code)) {
      const vars = computeAppearance({ ...SETTING_DEFAULTS, themeMode, accentColor }).vars;
      expect(contrast(vars['--accent-stroke'], vars['--surface-hover']), `${themeMode} ${accentColor}`).toBeGreaterThanOrEqual(3);
      expect(contrast(vars['--accent-stroke'], vars['--bg']), `${themeMode} ${accentColor}`).toBeGreaterThanOrEqual(3);
    }
  }
});

test('the scrollbar scales with the border width at about half its thickness and never gets thinner than 2px', () => {
  const widths = BORDER_WIDTHS.map(x => Number(x.code));
  const scrollbars = widths.map(width => computeAppearance({ ...SETTING_DEFAULTS, borderWidth: width }).vars['--scrollbar-width']);
  expect(scrollbars).toEqual(['2px', '2px', '2px', '2px', '3px', '3px', '4px']);
  expect(computeAppearance(SETTING_DEFAULTS).vars['--scrollbar-width']).toBe('3px');
});

test('appearance applies the border width to the shared CSS variable', () => {
  for (const width of BORDER_WIDTHS.map(x => x.code)) {
    expect(computeAppearance({ ...SETTING_DEFAULTS, borderWidth: width }).vars['--border-width']).toBe(`${width}px`);
  }
  expect(computeAppearance(SETTING_DEFAULTS).vars['--border-width']).toBe('5px');
  expect(BORDER_WIDTHS.map(x => computeAppearance({ ...SETTING_DEFAULTS, borderWidth: x.code }).vars['--border-width-compact'])).toEqual(['1px', '2px', '2px', '2px', '3px', '4px', '5px']);
  initAppearance();
  setSetting('borderWidth', 2);
  expect(document.documentElement.style.getPropertyValue('--border-width')).toBe('2px');
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

test('the normal text and icon size are a fifth and a tenth larger than the plain layout, and the large text mark follows the shown size', () => {
  const normal = computeAppearance({ ...SETTING_DEFAULTS });
  expect([normal.vars['--text-scale'], normal.vars['--icon-scale'], normal.attrs['data-text-large']]).toEqual(['1.2', '1.1', 'false']);
  const bigger = computeAppearance({ ...SETTING_DEFAULTS, textScale: 1.2, iconScale: 1.5 });
  expect([bigger.vars['--text-scale'], bigger.vars['--icon-scale'], bigger.attrs['data-text-large']]).toEqual(['1.44', '1.65', 'true']);
  expect(computeAppearance({ ...SETTING_DEFAULTS, textScale: 0.9 }).vars['--text-scale']).toBe('1.08');
});


test('the subtitle font App uses the font of the app with its size factor and follows it when that changes', () => {
  const vars = (uiFont: string, subtitleFont = 'app') => computeAppearance({ ...SETTING_DEFAULTS, uiFont, subtitleFont }).vars;
  expect(vars('console')['--sub-font']).toContain("'Inconsolata'");
  expect(vars('console')['--sub-scale']).toBe('1.15');
  expect(vars('inter')['--sub-font']).toBe(vars('inter', 'inter')['--sub-font']);
  expect(vars('default')['--sub-font']).toBe(vars('default', 'default')['--sub-font']);
  expect(vars('console', 'default')['--sub-font']).not.toContain('Inconsolata');
  expect(vars('console', 'silkscreen')['--sub-scale']).toBe('0.85');
});

test('the light themes are marked so the player keeps a dark scrim and white controls over the video', () => {
  const marked = THEME_MODES.map(x => x.code).filter(theme => computeAppearance({ ...SETTING_DEFAULTS, themeMode: theme }).attrs['data-light'] === 'true');
  expect(marked).toEqual(['light', 'lighttinted', 'frost', 'paper', 'chicago']);
  expect(computeAppearance({ ...SETTING_DEFAULTS, themeMode: 'unknown' }).attrs['data-light']).toBe('false');
  expect(computeAppearance({ ...SETTING_DEFAULTS, osdOpacity: 1 }).vars['--osd-top']).toBe('0.7');
});

test('a font can carry a size factor so its letters look as large as the others, for the text and the subtitles', () => {
  const plain = computeAppearance({ ...SETTING_DEFAULTS, uiFont: 'inter', subtitleFont: 'inter' }).vars;
  expect([plain['--text-scale'], plain['--sub-scale']]).toEqual(['1.2', '1']);
  const retro = computeAppearance({ ...SETTING_DEFAULTS, uiFont: 'vt323', subtitleFont: 'silkscreen' }).vars;
  expect([retro['--text-scale'], retro['--sub-scale']]).toEqual(['1.38', '0.85']);
  expect(computeAppearance({ ...SETTING_DEFAULTS, uiFont: 'unknown', subtitleFont: 'unknown' }).vars['--sub-scale']).toBe('1');
  for (const font of UI_FONTS) { expect(font.scale ?? 1, font.code).toBeGreaterThanOrEqual(0.8); expect(font.scale ?? 1, font.code).toBeLessThanOrEqual(1.4); }
});

test('the scrollbar size changes the strip, the thumb, the grown thumb and the colour of a resting thumb', () => {
  const sizes = (scrollbarSize: string, borderWidth = 5) => {
    const vars = computeAppearance({ ...SETTING_DEFAULTS, scrollbarSize, borderWidth }).vars;
    return [vars['--scrollbar-hit'], vars['--scrollbar-width'], vars['--scrollbar-grab'], vars['--scrollbar-rest']];
  };
  expect(sizes('normal')).toEqual(['14px', '3px', '8px', 'transparent']);
  expect(sizes('normal', 3)[1]).toBe('2px');
  expect(sizes('normal', 6)[1]).toBe('3px');
  expect(sizes('large')).toEqual(['28px', '12px', '20px', 'rgba(var(--text-rgb), 0.3)']);
  expect(sizes('hidden')).toEqual(['0px', '0px', '0px', 'transparent']);
  expect(sizes('unknown')).toEqual(sizes('normal'));
  expect(SETTING_DEFAULTS.scrollbarSize).toBe('normal');
});

test('the pixel fonts and the dyslexia font are evened out to the size of the others, in the text and the subtitles', () => {
  const scales = (font: string) => {
    const vars = computeAppearance({ ...SETTING_DEFAULTS, uiFont: font, subtitleFont: font }).vars;
    return [vars['--text-scale'], vars['--sub-scale']];
  };
  expect(scales('vt323')).toEqual(['1.38', '1.15']);
  expect(scales('jersey10')).toEqual(['1.32', '1.1']);
  expect(scales('tiny5')).toEqual(['1.2', '1']);
  expect(scales('opendyslexic')).toEqual(['1.02', '0.85']);
  expect(scales('silkscreen')).toEqual(['1.02', '0.85']);
});

test('changing the scrollbar size updates the scrollbar sizes of the page at once', () => {
  const stop = initAppearance();
  const hit = () => document.documentElement.style.getPropertyValue('--scrollbar-hit');
  expect(hit()).toBe('14px');
  act(() => { setSetting('scrollbarSize', 'large'); });
  expect(hit()).toBe('28px');
  act(() => { setSetting('scrollbarSize', 'hidden'); });
  expect(hit()).toBe('0px');
  act(() => { setSetting('scrollbarSize', 'normal'); });
  expect(hit()).toBe('14px');
  stop();
});
