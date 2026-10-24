import { useCallback, useSyncExternalStore } from 'react';
import { SETTING_DEFAULTS, SCALE_OPTIONS, TEXT_SCALE_OPTIONS, TEXT_SCALE_BASE, ICON_SCALE_BASE } from './constants';

export type Settings = typeof SETTING_DEFAULTS;
export type SettingKey = keyof Settings;
type Listener = (key: SettingKey) => void;
const listeners = new Set<Listener>();
const values: Partial<Record<SettingKey, string | number>> = {};

const LEGACY: Partial<Record<SettingKey, { key: string; map: Record<string, string> }>> = {
  spinnerStyle: { key: 'loaderStyle', map: { orbit: 'orbit', ring: 'ring', dots: 'dots' } },
  subtitleColor: { key: 'subtitleStyle', map: { green: '#AAF40D', white: '#FFFFFF', black: '#000000' } },
  logoButton: { key: 'settingsEntry', map: { icon: 'off', logo: 'settings' } },
};

const VALUE_ALIASES: Partial<Record<SettingKey, Record<string, string>>> = { previewVideo: { off: 'still' } };

function parseStored(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

// Saved sizes keep their look as the nearest smaller choice
const SCALE_MARK = 'scaleBase';
let scalesMigrated = false;
function migrateScales() {
  if (scalesMigrated) return;
  scalesMigrated = true;
  try {
    if (localStorage.getItem(SCALE_MARK) !== null) return;
    for (const [key, base, options] of [['textScale', TEXT_SCALE_BASE, TEXT_SCALE_OPTIONS], ['iconScale', ICON_SCALE_BASE, SCALE_OPTIONS]] as const) {
      const raw = localStorage.getItem(key);
      const stored = raw === null ? null : parseStored(raw);
      if (typeof stored !== 'number' || !Number.isFinite(stored)) continue;
      const wanted = stored / base;
      const nearest = options.map((option) => option.code).reduce((best, code) => (Math.abs(code - wanted) < Math.abs(best - wanted) ? code : best));
      localStorage.setItem(key, JSON.stringify(nearest));
    }
    localStorage.setItem(SCALE_MARK, '1');
  } catch { /* storage is not available */ }
}

function readStored<K extends SettingKey>(key: K): Settings[K] {
  const fallback = SETTING_DEFAULTS[key];
  migrateScales();
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      const legacy = LEGACY[key];
      if (!legacy) return fallback;
      const legacyRaw = localStorage.getItem(legacy.key);
      return ((legacyRaw !== null && legacy.map[String(parseStored(legacyRaw))]) || fallback) as Settings[K];
    }
    const stored = parseStored(raw);
    const parsed = VALUE_ALIASES[key]?.[String(stored)] || stored;
    return typeof parsed === typeof fallback ? parsed as Settings[K] : fallback;
  } catch { return fallback; }
}

export function getSetting<K extends SettingKey>(key: K): Settings[K] {
  if (!(key in values)) values[key] = readStored(key);
  return values[key] as Settings[K];
}

export function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  values[key] = value;
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (error) { console.error('Could not save setting', key, error); }
  listeners.forEach((listener) => listener(key));
}

export function subscribeSettings(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSetting<K extends SettingKey>(key: K): [Settings[K], (next: Settings[K]) => void] {
  const subscribe = useCallback((onChange: () => void) => subscribeSettings((changed) => {
    if (changed === key) onChange();
  }), [key]);
  const value = useSyncExternalStore(subscribe, () => getSetting(key));
  const set = useCallback((next: Settings[K]) => setSetting(key, next), [key]);
  return [value, set];
}
