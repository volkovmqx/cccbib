import { API_BASE } from '../api';
import { fromRest } from '../search';

const MAX_ITEMS = 50;

const LINK_PATTERN = /^(?:https?:\/\/)?media\.ccc\.de\/v\/([A-Za-z0-9][A-Za-z0-9._-]*)(?:[/?#].*)?$/i;
const CCC_URL_PATTERN = /^https:\/\/(?:[a-z0-9-]+\.)*media\.ccc\.de\//i;

export function talkReference(link) {
  const match = LINK_PATTERN.exec(String(link || '').trim());
  return match ? match[1] : null;
}

export async function fetchTalk(link) {
  const reference = talkReference(link);
  if (!reference) throw new Error('Only media.ccc.de/v/ links are accepted');
  const response = await fetch(`${API_BASE}/events/${encodeURIComponent(reference)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Talk request failed (${response.status})`);
  const talk = fromRest(await response.json());
  const fromCcc = (item) => CCC_URL_PATTERN.test(item.url || '');
  return { ...talk, videos: talk.videos.filter(fromCcc), subtitles: talk.subtitles.filter(fromCcc) };
}

const number = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function commandItems(command) {
  const items = [];
  const add = (entry) => {
    if (typeof entry === 'string') entry = { link: entry };
    // Keep invalid entries so progress-set can reject the entire replacement.
    items.push({
      link: entry && typeof entry.link === 'string' ? entry.link : null,
      position: number(entry && entry.position),
      percent: number(entry && entry.percent),
    });
  };
  if (Array.isArray(command.items)) command.items.forEach(add);
  if (Array.isArray(command.links)) command.links.forEach(add);
  if (command.link !== undefined) add({ link: command.link, position: command.position, percent: command.percent });
  return items.slice(0, MAX_ITEMS);
}
