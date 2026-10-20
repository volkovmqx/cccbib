import type { Talk } from '../model/types';
import { API_BASE } from '@/shared/api';
import { fromRest } from './mapping';

const LINK_PATTERN = /^(?:https?:\/\/)?media\.ccc\.de\/v\/([A-Za-z0-9][A-Za-z0-9._-]*)(?:[/?#].*)?$/i;
const CCC_URL_PATTERN = /^https:\/\/(?:[a-z0-9-]+\.)*media\.ccc\.de\//i;

export function talkReference(link: unknown) {
  const match = LINK_PATTERN.exec(String(link || '').trim());
  return match ? match[1] : null;
}

export async function fetchTalk(link: unknown): Promise<Talk> {
  const reference = talkReference(link);
  if (!reference) throw new Error('Only media.ccc.de/v/ links are accepted');
  const response = await fetch(`${API_BASE}/events/${encodeURIComponent(reference)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Talk request failed (${response.status})`);
  const talk = fromRest(await response.json());
  const fromCcc = (item: { url: string }) => CCC_URL_PATTERN.test(item.url || '');
  return { ...talk, videos: talk.videos.filter(fromCcc), subtitles: (talk.subtitles || []).filter(fromCcc) };
}

