import { useCallback, useSyncExternalStore } from 'react';
import { SETTING_DEFAULTS } from './constants';

const listeners = new Set();
const values = {};

const LEGACY = {
  spinnerStyle: { key: 'loaderStyle', map: { orbit: 'orbit', ring: 'ring', dots: 'dots' } },
  subtitleColor: { key: 'subtitleStyle', map: { green: '#AAF40D', white: '#FFFFFF', black: '#000000' } },
};

const VALUE_ALIASES = {
  previewVideo: { off: 'still' },
};

function parseStored(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return raw;
  }
}

function readStored(key) {
  const fallback = SETTING_DEFAULTS[key];
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      const legacy = LEGACY[key];
      if (!legacy) return fallback;
      const legacyRaw = localStorage.getItem(legacy.key);
      return (legacyRaw !== null && legacy.map[parseStored(legacyRaw)]) || fallback;
    }
    const stored = parseStored(raw);
    const parsed = (VALUE_ALIASES[key] && VALUE_ALIASES[key][stored]) || stored;
    return typeof parsed === typeof fallback ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

export function getSetting(key) {
  if (!(key in values)) values[key] = readStored(key);
  return values[key];
}

export function setSetting(key, value) {
  values[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Could not save setting', key, error);
  }
  listeners.forEach((listener) => listener(key));
}

export function subscribeSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSetting(key) {
  const subscribe = useCallback((onChange) => subscribeSettings((changed) => {
    if (changed === key) onChange();
  }), [key]);
  const value = useSyncExternalStore(subscribe, () => getSetting(key));
  const set = useCallback((next) => setSetting(key, next), [key]);
  return [value, set];
}
