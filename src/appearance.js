import { SETTING_DEFAULTS, SYSTEM_FONT_STACK, UI_FONTS, CORNER_STYLES } from './constants';
import { getSetting, subscribeSettings } from './settings';

const BOOT_KEY = 'appearance_boot';
const APPEARANCE_SETTINGS = [
  'themeMode', 'accentColor', 'uiFont', 'loaderStyle', 'railStyle', 'glassSheen', 'glassTransparency', 'menuIconColor', 'menuActiveColor', 'buttonStyle', 'cornerStyle',
  'textScale', 'tileScale', 'iconScale', 'menuScale',
  'subtitleSize', 'subtitleFont', 'subtitleColor', 'subtitleBackground',
  'osdScale', 'osdOpacity', 'osdMenuOpacity', 'osdHandle', 'osdBarColor', 'osdButtonShape', 'osdIdleButtons',
];

const PALETTES = {
  black: { bg: '#000000', surface: '#17171a', surfaceAlt: '#0e0e11', surfaceHover: '#212126', text: '#ffffff', muted: '#909296', dim: '#666666', border: '#2a2a30' },
  dark: { bg: '#141517', surface: '#25262b', surfaceAlt: '#1a1b1e', surfaceHover: '#2c2e33', text: '#ffffff', muted: '#909296', dim: '#666666', border: '#373a40' },
  light: { bg: '#f4f5f7', surface: '#ffffff', surfaceAlt: '#e6e8ec', surfaceHover: '#e0e3e8', text: '#1a1b1e', muted: '#5c5f66', dim: '#868e96', border: '#ced4da' },
};

const hexToRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) } : { r: 170, g: 244, b: 13 };
};

const rgbToHsl = ({ r, g, b }) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
};

const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue(p, q, h + 1 / 3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1 / 3) * 255),
  };
};

const toHex = ({ r, g, b }) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
const rgbString = ({ r, g, b }) => `${r}, ${g}, ${b}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const luminance = ({ r, g, b }) => {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

function accentVars(accentColor, isLight) {
  const rgb = hexToRgb(accentColor);
  const { h, s, l } = rgbToHsl(rgb);
  const textLightness = isLight ? Math.min(l, 38) : Math.max(l, 48);
  return {
    '--accent': toHex(rgb),
    '--accent-rgb': rgbString(rgb),
    '--accent-glow': `0 0 10px rgba(${rgbString(rgb)}, 0.5)`,
    '--accent-contrast': luminance(rgb) > 0.4 ? '#000000' : '#ffffff',
    '--accent-text': toHex(hslToRgb(h, s, textLightness)),
    '--logo-dim': Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) < 30 && Math.min(rgb.r, rgb.g, rgb.b) > 215 && !isLight ? '0.55' : '1',
  };
}

function tintedPalette(accentColor) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.6, 30, 54);
  const tone = (lightness, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(10), surface: tone(20), surfaceAlt: tone(15), surfaceHover: tone(27), border: tone(32),
    text: '#ffffff', muted: tone(70, Math.min(saturation, 22)), dim: tone(50, Math.min(saturation, 14)),
  };
}

function ambientPalette(accentColor) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.4, 14, 32);
  const tone = (lightness, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(6), surface: tone(14), surfaceAlt: tone(10), surfaceHover: tone(20), border: tone(25),
    text: '#ffffff', muted: tone(72, Math.min(saturation, 16)), dim: tone(52, Math.min(saturation, 12)),
  };
}

function lightTintedPalette(accentColor) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.55, 26, 58);
  const tone = (lightness, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(94), surface: tone(98, saturation * 0.7), surfaceAlt: tone(90), surfaceHover: tone(86), border: tone(78),
    text: tone(11, Math.min(saturation, 24)), muted: tone(36, Math.min(saturation, 18)), dim: tone(52, Math.min(saturation, 14)),
  };
}

export const isLightTheme = (themeMode) => themeMode === 'light' || themeMode === 'lighttinted';

function paletteVars(palette) {
  return {
    '--bg': palette.bg,
    '--bg-rgb': rgbString(hexToRgb(palette.bg)),
    '--surface': palette.surface,
    '--surface-rgb': rgbString(hexToRgb(palette.surface)),
    '--surface-alt': palette.surfaceAlt,
    '--surface-hover': palette.surfaceHover,
    '--text': palette.text,
    '--text-muted': palette.muted,
    '--text-dim': palette.dim,
    '--text-rgb': rgbString(hexToRgb(palette.text)),
    '--border-color': palette.border,
  };
}

const contrastRatio = (a, b) => {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const readableOn = (color, background) => (
  contrastRatio(color, background) >= 3 ? color : (luminance(hexToRgb(background)) > 0.4 ? '#000000' : '#ffffff')
);

export function buttonColors(style, accentColor, palette) {
  const accent = toHex(hexToRgb(accentColor));
  switch (style) {
    case 'inverted': return [palette.text, palette.bg];
    case 'white-black': return ['#ffffff', '#000000'];
    case 'black-white': return ['#000000', '#ffffff'];
    case 'white-accent': return ['#ffffff', readableOn(accent, '#ffffff')];
    case 'black-accent': return ['#000000', readableOn(accent, '#000000')];
    case 'accent-white': return [accent, readableOn('#ffffff', accent)];
    case 'accent-black': return [accent, readableOn('#000000', accent)];
    default: return [accent, luminance(hexToRgb(accent)) > 0.4 ? '#000000' : '#ffffff'];
  }
}

export const paletteFor = (themeMode, accentColor) => {
  if (themeMode === 'tinted') return tintedPalette(accentColor);
  if (themeMode === 'ambient') return ambientPalette(accentColor);
  if (themeMode === 'lighttinted') return lightTintedPalette(accentColor);
  return PALETTES[themeMode] || PALETTES.black;
};

function buttonVars(settings, palette) {
  const [fill, text] = buttonColors(settings.buttonStyle, settings.accentColor, palette);
  const ring = contrastRatio(fill, palette.bg) < 2 ? palette.text : 'transparent';
  const radii = (CORNER_STYLES.find((corner) => corner.code === settings.cornerStyle) || CORNER_STYLES[1]).radii;
  return {
    '--btn-bg': fill,
    '--btn-fg': text,
    '--focus-ring': ring,
    '--border-radius-sm': `${radii[0]}px`,
    '--border-radius-md': `${radii[1]}px`,
    '--border-radius-lg': `${radii[2]}px`,
    '--border-radius-xl': `${radii[3]}px`,
  };
}

const fontStack = (code) => {
  const font = UI_FONTS.find((f) => f.code === code);
  return font && font.family ? `'${font.family}', ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;
};

function subtitleVars({ subtitleColor, subtitleBackground, subtitleFont }, accentColor) {
  const color = toHex(hexToRgb(subtitleColor === 'accent' ? accentColor : subtitleColor));
  const darkText = luminance(hexToRgb(color)) < 0.1;
  const background = subtitleBackground === 'auto' ? (darkText ? 'light' : 'dark') : subtitleBackground;
  const outline = darkText ? '#fff' : '#000';
  return {
    '--sub-color': color,
    '--sub-bg': background === 'light' ? 'rgba(255, 255, 255, 0.9)' : background === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
    '--sub-shadow': background === 'outline' ? `0 0 4px ${outline}, 0 0 4px ${outline}, 1px 1px 3px ${outline}` : 'none',
    '--sub-font': fontStack(subtitleFont),
  };
}

export function computeAppearance(settings) {
  const { themeMode, accentColor, uiFont, loaderStyle, railStyle, glassSheen, glassTransparency, textScale, tileScale, iconScale, menuScale } = settings;
  const palette = paletteFor(themeMode, accentColor);
  const accent = accentVars(accentColor, isLightTheme(themeMode));
  const menuColor = (code) => ({ grey: palette.muted, white: '#ffffff', black: '#000000', accent: accent['--accent-text'] }[code] || palette.muted);
  return {
    attrs: { 'data-theme': themeMode, 'data-loader': loaderStyle, 'data-rail': railStyle, 'data-shine': glassSheen, 'data-glass-transparency': glassTransparency,
      'data-text-large': String(textScale >= 1.4), 'data-osd-handle': settings.osdHandle, 'data-osd-bar': settings.osdBarColor, 'data-osd-shape': settings.osdButtonShape, 'data-osd-idle': settings.osdIdleButtons },
    vars: {
      ...accent,
      '--gloss': isLightTheme(themeMode) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.14)',
      ...paletteVars(palette),
      ...subtitleVars(settings, accentColor),
      ...buttonVars(settings, palette),
      '--osd-scale': String(settings.osdScale),
      '--osd-a1': String(+(0.92 * settings.osdOpacity).toFixed(3)),
      '--osd-a2': String(+(0.7 * settings.osdOpacity).toFixed(3)),
      '--osd-a3': String(+(0.25 * settings.osdOpacity).toFixed(3)),
      '--osd-top': String(+(0.55 * settings.osdOpacity).toFixed(3)),
      '--osd-menu': String(settings.osdMenuOpacity),
      '--menu-icon': menuColor(settings.menuIconColor),
      '--menu-active': menuColor(settings.menuActiveColor),
      '--ui-font': fontStack(uiFont),
      '--text-scale': String(textScale),
      '--tile-scale': String(tileScale),
      '--icon-scale': String(iconScale),
      '--menu-scale': String(menuScale),
    },
  };
}

export function applyAppearance() {
  const appearance = computeAppearance(Object.fromEntries(
    Object.keys(SETTING_DEFAULTS).map((key) => [key, getSetting(key)])
  ));

  const root = document.documentElement;
  Object.keys(appearance.attrs).forEach((name) => root.setAttribute(name, appearance.attrs[name]));
  root.setAttribute('data-subtitle-size', getSetting('subtitleSize'));
  Object.keys(appearance.vars).forEach((name) => root.style.setProperty(name, appearance.vars[name]));

  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify(appearance));
  } catch (error) {
    console.error('Could not cache appearance', error);
  }
}

export function initAppearance() {
  applyAppearance();
  subscribeSettings((key) => {
    if (APPEARANCE_SETTINGS.includes(key)) applyAppearance();
  });
}
