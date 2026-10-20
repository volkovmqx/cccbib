import type { Conference } from '@/entities/conference';
import type { Talk } from '@/entities/talk';

export function talk(overrides: Partial<Talk> = {}): Talk {
  return {
    guid: 'talk', slug: 'talk', title: 'Test talk', description: 'Talk description', duration: 600,
    viewCount: 12, persons: ['Speaker'], conference_title: 'Test conference',
    images: { thumbUrl: 'https://static.media.ccc.de/thumb.svg', posterUrl: 'https://static.media.ccc.de/poster.svg' },
    videos: [{ url: 'https://static.media.ccc.de/test.webm', mimeType: 'video/webm', language: 'deu', width: 640, height: 480 }],
    subtitles: [], ...overrides,
  };
}

export function conference(overrides: Partial<Conference> = {}): Conference {
  return { id: 'conf', title: 'Test conference', lectures: { nodes: [talk()] }, ...overrides };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export function media(video: HTMLVideoElement, values: Partial<HTMLVideoElement> = {}) {
  for (const [key, value] of Object.entries({ duration: 600, readyState: 4, videoWidth: 640, videoHeight: 480, paused: false, ended: false, ...values })) {
    Object.defineProperty(video, key, { configurable: true, writable: true, value });
  }
  return video;
}
