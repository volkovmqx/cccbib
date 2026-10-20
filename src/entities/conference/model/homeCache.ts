import type { Conference } from './types';
import { isTalk } from '@/entities/talk/@x/conference';

const KEY = 'home_cache_v1';
const MAX_CHARS = 1500000;

let savedJson: string | null = null;

function isConference(value: unknown): value is Conference {
  if (!value || typeof value !== 'object') return false;
  const conference = value as Partial<Conference>;
  return typeof conference.title === 'string'
    && (conference.id === undefined || typeof conference.id === 'string')
    && (conference.updatedAt === undefined || typeof conference.updatedAt === 'string')
    && (conference.eventLastReleasedAt === undefined || typeof conference.eventLastReleasedAt === 'string')
    && Array.isArray(conference.lectures?.nodes) && conference.lectures.nodes.every(isTalk);
}

export function loadHomeCache(): Conference[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    const conferences: unknown = raw && JSON.parse(raw);
    if (!Array.isArray(conferences) || conferences.length === 0 || !conferences.every(isConference)) return null;
    savedJson = raw;
    return conferences;
  } catch (error) {
    return null;
  }
}

export function saveHomeCache(conferences: Conference[]) {
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
