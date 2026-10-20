const KEY = 'home_cache_v1';
const MAX_CHARS = 1500000;

let savedJson = null;

export function loadHomeCache() {
  try {
    const raw = localStorage.getItem(KEY);
    const conferences = raw && JSON.parse(raw);
    if (!Array.isArray(conferences) || conferences.length === 0) return null;
    savedJson = raw;
    return conferences;
  } catch (error) {
    return null;
  }
}

export function saveHomeCache(conferences) {
  if (!conferences || conferences.length === 0) return;
  try {
    const json = JSON.stringify(conferences);
    if (json === savedJson || json.length > MAX_CHARS) return;
    localStorage.setItem(KEY, json);
    savedJson = json;
  } catch (error) {
    console.error('Could not cache home data', error);
  }
}

export function clearHomeCache() {
  localStorage.removeItem(KEY);
  savedJson = null;
}
