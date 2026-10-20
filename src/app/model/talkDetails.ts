import type { Talk, RestTalk } from '@/entities/talk';
import type { PlaybackHistoryItem } from '@/features/playback-history';
import { API_BASE } from '@/shared/api';
import { PLAYBACK_HISTORY_KEY, PLAYBACK_HISTORY_EVENT } from '@/features/playback-history';
import { readWatchlist, writeWatchlist } from '@/features/watchlist';

const MAX_LOOKUPS = 40;
const PARALLEL = 3;

const needsDetails = (event: Talk) => Boolean(event && !event.detailsChecked && Array.isArray(event.videos)
  && (!event.slug || event.videos.some((video) => video.url && video.width && !video.height)));

function readHistoryStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYBACK_HISTORY_KEY) || 'null') as { version: number; items: PlaybackHistoryItem[] } | null;
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  } catch (err) {
    return null;
  }
}

async function fetchDetails(guid: string) {
  const response = await fetch(`${API_BASE}/events/${encodeURIComponent(guid)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json() as RestTalk;
  const heights = new Map<string, number>();
  (data.recordings || []).forEach((recording) => {
    if (recording.recording_url && recording.height) heights.set(recording.recording_url, recording.height);
  });
  return { slug: data.slug, heights };
}

function withDetails(event: Talk, details: { slug?: string; heights: Map<string, number> }) {
  if (!needsDetails(event)) return event;
  return {
    ...event,
    slug: event.slug || details.slug,
    detailsChecked: true,
    videos: event.videos.map((video) => (!video.height && details.heights.has(video.url) ? { ...video, height: details.heights.get(video.url) } : video)),
  };
}

export async function backfillTalkDetails() {
  const history = readHistoryStore();
  const events = [...readWatchlist(), ...(history ? history.items.map((item) => item.event) : [])];
  const guids = [...new Set(events.filter(needsDetails).map((event) => event.guid))].slice(0, MAX_LOOKUPS);
  if (guids.length === 0) return;

  const found = new Map<string, { slug?: string; heights: Map<string, number> }>();
  for (let start = 0; start < guids.length; start += PARALLEL) {
    await Promise.all(guids.slice(start, start + PARALLEL).map(async (guid) => {
      try {
        const details = await fetchDetails(guid);
        if (details) found.set(guid, details);
      } catch (err) { }
    }));
  }
  if (found.size === 0) return;

  const watchlist = readWatchlist();
  if (watchlist.some((item) => found.has(item.guid) && needsDetails(item))) {
    writeWatchlist(watchlist.map((item) => (found.has(item.guid) ? withDetails(item, found.get(item.guid)!) : item)));
  }

  const latest = readHistoryStore();
  if (latest && latest.items.some((item) => item.event && found.has(item.event.guid) && needsDetails(item.event))) {
    const items = latest.items.map((item) => (item.event && found.has(item.event.guid) ? { ...item, event: withDetails(item.event, found.get(item.event.guid)!) } : item));
    localStorage.setItem(PLAYBACK_HISTORY_KEY, JSON.stringify({ ...latest, items }));
    window.dispatchEvent(new Event(PLAYBACK_HISTORY_EVENT));
  }
}
