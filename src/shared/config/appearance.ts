import type { Settings, SettingKey } from './settings';
import { SETTING_DEFAULTS, SYSTEM_FONT_STACK, UI_FONTS, CORNER_STYLES, TEXT_SCALE_BASE, ICON_SCALE_BASE } from './constants';
import { getSetting, subscribeSettings } from './settings';

interface RGB { r: number; g: number; b: number }
interface Palette { bg: string; surface: string; surfaceAlt: string; surfaceHover: string; text: string; muted: string; dim: string; border: string }



const BOOT_KEY = 'appearance_boot';
const APPEARANCE_SETTINGS = [
  'themeMode', 'accentColor', 'uiFont', 'loaderStyle', 'railStyle', 'glassSheen', 'glassTransparency', 'menuIconColor', 'menuActiveColor', 'navIndicator', 'buttonStyle', 'cornerStyle', 'borderWidth', 'scrollbarSize',
  'textScale', 'tileScale', 'iconScale', 'menuScale', 'menuPosition',
  'subtitleSize', 'subtitleFont', 'subtitleColor', 'subtitleBackground',
  'osdScale', 'osdOpacity', 'osdMenuOpacity', 'osdHandle', 'osdBarColor', 'osdButtonShape', 'osdIdleButtons',
];

const PALETTES: Record<string, Palette> = {
  black: { bg: '#000000', surface: '#17171a', surfaceAlt: '#0e0e11', surfaceHover: '#212126', text: '#ffffff', muted: '#909296', dim: '#666666', border: '#2a2a30' },
  dark: { bg: '#141517', surface: '#25262b', surfaceAlt: '#1a1b1e', surfaceHover: '#2c2e33', text: '#ffffff', muted: '#909296', dim: '#666666', border: '#373a40' },
  light: { bg: '#f4f5f7', surface: '#ffffff', surfaceAlt: '#e6e8ec', surfaceHover: '#e0e3e8', text: '#1a1b1e', muted: '#5c5f66', dim: '#868e96', border: '#ced4da' },
  ember: { bg: '#0d0906', surface: '#20150c', surfaceAlt: '#150d07', surfaceHover: '#362213', text: '#fff4ea', muted: '#bfa994', dim: '#85725f', border: '#3a2615' },
  sunset: { bg: '#1c142e', surface: '#302034', surfaceAlt: '#241938', surfaceHover: '#45293a', text: '#ffffff', muted: '#c9b3b8', dim: '#92808f', border: '#4d3042' },
  frost: { bg: '#e8f1f6', surface: '#ffffff', surfaceAlt: '#dde9f1', surfaceHover: '#d2e3ee', text: '#1b2c38', muted: '#466171', dim: '#6a8495', border: '#c0d3df' },
  nocturne: { bg: '#0c0e13', surface: '#1a1d22', surfaceAlt: '#12151d', surfaceHover: '#2c3036', text: '#f6f2ea', muted: '#b0aca2', dim: '#7c7a73', border: '#282b32' },
  abyss: { bg: '#06111c', surface: '#0f1f29', surfaceAlt: '#03101a', surfaceHover: '#1a2f38', text: '#eff7f6', muted: '#9fb7b8', dim: '#6d898c', border: '#1d3640' },
  cyberpunk: { bg: '#0a0713', surface: '#140f24', surfaceAlt: '#100b1e', surfaceHover: '#201939', text: '#f2f4ff', muted: '#b0aabf', dim: '#7a7491', border: '#2a2048' },
  terminal: { bg: '#050b08', surface: '#0f1a14', surfaceAlt: '#09120d', surfaceHover: '#19291f', text: '#e8f6ee', muted: '#9db8a8', dim: '#68846f', border: '#1f3528' },
  chicago: { bg: '#c0c0c0', surface: '#dfdfdf', surfaceAlt: '#b3b3b3', surfaceHover: '#a5a5a5', text: '#000000', muted: '#2e2e2e', dim: '#575757', border: '#808080' },
  paper: { bg: '#f2ead9', surface: '#faf5ea', surfaceAlt: '#e9dfca', surfaceHover: '#e2d6bc', text: '#332a1f', muted: '#5d5245', dim: '#7d705d', border: '#d6c9ae' },
};

const LIGHT_THEMES = ['light', 'lighttinted', 'frost', 'paper', 'chicago'];
const CANVAS_THEMES = ['ambient', 'ember', 'sunset', 'frost', 'paper', 'nocturne', 'abyss', 'cyberpunk', 'terminal', 'chicago'];

const hexToRgb = (hex: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) } : { r: 170, g: 244, b: 13 };
};

const rgbToHsl = ({ r, g, b }: RGB) => {
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

const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (p: number, q: number, t: number) => {
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

const toHex = ({ r, g, b }: RGB) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
const rgbString = ({ r, g, b }: RGB) => `${r}, ${g}, ${b}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const luminance = ({ r, g, b }: RGB) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

function accentVars(accentColor: string, isLight: boolean) {
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

function tintedPalette(accentColor: string) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.6, 30, 54);
  const tone = (lightness: number, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(10), surface: tone(20), surfaceAlt: tone(15), surfaceHover: tone(27), border: tone(32),
    text: '#ffffff', muted: tone(70, Math.min(saturation, 22)), dim: tone(50, Math.min(saturation, 14)),
  };
}

function ambientPalette(accentColor: string) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.4, 14, 32);
  const tone = (lightness: number, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(6), surface: tone(14), surfaceAlt: tone(10), surfaceHover: tone(20), border: tone(25),
    text: '#ffffff', muted: tone(72, Math.min(saturation, 16)), dim: tone(52, Math.min(saturation, 12)),
  };
}

function lightTintedPalette(accentColor: string) {
  const { h, s } = rgbToHsl(hexToRgb(accentColor));
  const saturation = s < 8 ? 0 : clamp(s * 0.55, 26, 58);
  const tone = (lightness: number, sat = saturation) => toHex(hslToRgb(h, sat, lightness));
  return {
    bg: tone(94), surface: tone(98, saturation * 0.7), surfaceAlt: tone(90), surfaceHover: tone(86), border: tone(78),
    text: tone(11, Math.min(saturation, 24)), muted: tone(36, Math.min(saturation, 18)), dim: tone(52, Math.min(saturation, 14)),
  };
}

export const isLightTheme = (themeMode: string) => LIGHT_THEMES.includes(themeMode);

function paletteVars(palette: Palette) {
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

const contrastRatio = (a: string, b: string) => {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

function strokeColor(accentColor: string, palette: Palette, isLight: boolean) {
  const { h, s, l } = rgbToHsl(hexToRgb(accentColor));
  let lightness = isLight ? Math.min(l, 38) : Math.max(l, 48);
  let color = toHex(hslToRgb(h, s, lightness));
  for (let step = 0; step < 50 && contrastRatio(color, palette.surfaceHover) < 3; step++) {
    lightness = clamp(lightness + (isLight ? -2 : 2), 0, 100);
    color = toHex(hslToRgb(h, s, lightness));
  }
  return color;
}

const readableOn = (color: string, background: string) => (
  contrastRatio(color, background) >= 3 ? color : (luminance(hexToRgb(background)) > 0.4 ? '#000000' : '#ffffff')
);

const bestContrast = (background: string) => (contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff');

function navIndicatorVars({ menuActiveColor }: Settings, activeColor: string, accent: string, palette: Palette) {
  const fill = menuActiveColor === 'accent' ? palette.text : accent;
  return {
    '--nav-fill': fill,
    '--nav-fill-fg': contrastRatio(activeColor, fill) >= 3 ? activeColor : bestContrast(fill),
  };
}

export function buttonColors(style: string, accentColor: string, palette: Palette) {
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

export const paletteFor = (themeMode: string, accentColor: string) => {
  if (themeMode === 'tinted') return tintedPalette(accentColor);
  if (themeMode === 'ambient') return ambientPalette(accentColor);
  if (themeMode === 'lighttinted') return lightTintedPalette(accentColor);
  return PALETTES[themeMode] || PALETTES.black;
};

function buttonVars(settings: Settings, palette: Palette) {
  const [fill, text] = buttonColors(settings.buttonStyle, settings.accentColor, palette);
  const ring = contrastRatio(fill, palette.bg) < 2 ? palette.text : 'transparent';
  const radii = (CORNER_STYLES.find((corner) => corner.code === settings.cornerStyle) || CORNER_STYLES[1]).radii;
  return {
    '--btn-bg': fill,
    '--btn-bg-rgb': rgbString(hexToRgb(fill)),
    '--btn-fg': text,
    '--btn-fg-rgb': rgbString(hexToRgb(text)),
    '--focus-ring': ring,
    '--border-radius-sm': `${radii[0]}px`,
    '--border-radius-md': `${radii[1]}px`,
    '--border-radius-lg': `${radii[2]}px`,
    '--border-radius-xl': `${radii[3]}px`,
  };
}

const fontStack = (code: string) => {
  const font = UI_FONTS.find((f) => f.code === code);
  return font && font.family ? `'${font.family}', ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;
};

function scrollbarVars({ scrollbarSize, borderWidth }: Settings) {
  const thin = Math.max(2, Math.round(borderWidth / 2));
  const [hit, width, grab] = ({ large: [28, 12, 20], hidden: [0, 0, 0] } as Record<string, number[]>)[scrollbarSize] || [14, thin, 8];
  return {
    '--scrollbar-hit': `${hit}px`,
    '--scrollbar-width': `${width}px`,
    '--scrollbar-grab': `${grab}px`,
    '--scrollbar-rest': scrollbarSize === 'large' ? 'rgba(var(--text-rgb), 0.3)' : 'transparent',
  };
}

const fontScale = (code: string) => UI_FONTS.find((f) => f.code === code)?.scale ?? 1;

function subtitleVars({ subtitleColor, subtitleBackground, subtitleFont, uiFont }: Settings, accentColor: string, palette: Palette) {
  const color = toHex(hexToRgb(subtitleColor === 'accent' ? accentColor : subtitleColor));
  const darkText = luminance(hexToRgb(color)) < 0.1;
  const background = subtitleBackground === 'auto' ? (darkText ? 'light' : 'dark') : subtitleBackground;
  const outline = darkText ? '#fff' : '#000';
  const font = subtitleFont === 'app' ? uiFont : subtitleFont;
  return {
    '--sub-color': color,
    '--sub-bg': background === 'light' ? 'rgba(255, 255, 255, 0.9)' : background === 'dark' ? 'rgba(0, 0, 0, 0.8)' : background === 'theme' ? `rgba(${rgbString(hexToRgb(palette.surface))}, 0.9)` : 'transparent',
    '--sub-shadow': background === 'outline' ? `0 0 4px ${outline}, 0 0 4px ${outline}, 1px 1px 3px ${outline}` : 'none',
    '--sub-font': fontStack(font),
    '--sub-scale': String(fontScale(font)),
  };
}

export function computeAppearance(settings: Settings): { attrs: Record<string, string>; vars: Record<string, string> } {
  const { themeMode, accentColor, uiFont, loaderStyle, railStyle, glassSheen, glassTransparency, textScale, tileScale, iconScale, menuScale } = settings;
  const palette = paletteFor(themeMode, accentColor);
  const accent = accentVars(accentColor, isLightTheme(themeMode));
  const menuColor = (code: string) => (({ grey: palette.muted, white: '#ffffff', black: '#000000', accent: accent['--accent-text'] } as Record<string, string>)[code] || palette.muted);
  return {
    attrs: { 'data-theme': themeMode, 'data-light': String(isLightTheme(themeMode)), 'data-canvas': CANVAS_THEMES.includes(themeMode) ? 'glow' : 'none', 'data-loader': loaderStyle, 'data-rail': railStyle, 'data-shine': glassSheen, 'data-glass-transparency': glassTransparency, 'data-nav-indicator': settings.navIndicator, 'data-menu-position': settings.menuPosition,
      'data-text-large': String(textScale * TEXT_SCALE_BASE >= 1.4), 'data-osd-handle': settings.osdHandle, 'data-osd-bar': settings.osdBarColor, 'data-osd-shape': settings.osdButtonShape, 'data-osd-idle': settings.osdIdleButtons },
    vars: {
      ...accent,
      '--accent-stroke': strokeColor(accentColor, palette, isLightTheme(themeMode)),
      '--gloss': isLightTheme(themeMode) ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.14)',
      ...paletteVars(palette),
      ...subtitleVars(settings, accentColor, palette),
      ...buttonVars(settings, palette),
      '--osd-scale': String(settings.osdScale),
      '--osd-a1': String(+(0.92 * settings.osdOpacity).toFixed(3)),
      '--osd-a2': String(+(0.7 * settings.osdOpacity).toFixed(3)),
      '--osd-a3': String(+(0.25 * settings.osdOpacity).toFixed(3)),
      '--osd-top': String(+(0.7 * settings.osdOpacity).toFixed(3)),
      '--osd-menu': String(settings.osdMenuOpacity),
      '--menu-icon': menuColor(settings.menuIconColor),
      '--menu-active': menuColor(settings.menuActiveColor),
      ...navIndicatorVars(settings, menuColor(settings.menuActiveColor), accent['--accent'], palette),
      '--ui-font': fontStack(uiFont),
      '--text-scale': String(+(textScale * TEXT_SCALE_BASE * fontScale(uiFont)).toFixed(3)),
      '--tile-scale': String(tileScale),
      '--icon-scale': String(+(iconScale * ICON_SCALE_BASE).toFixed(3)),
      '--menu-scale': String(menuScale),
      '--border-width': `${settings.borderWidth}px`,
      '--border-width-compact': `${Math.min(settings.borderWidth, Math.max(2, Math.round(settings.borderWidth * 0.6)))}px`,
      ...scrollbarVars(settings),
    },
  };
}

export function applyAppearance() {
  const appearance = computeAppearance(Object.fromEntries(
    (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => [key, getSetting(key)])
  ) as Settings);

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
  return subscribeSettings((key) => {
    if (APPEARANCE_SETTINGS.includes(key)) applyAppearance();
  });
}
