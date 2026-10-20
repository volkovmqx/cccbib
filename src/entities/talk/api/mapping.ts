import type { Talk, GraphqlTalk, RestTalk } from '../model/types';

export const fromGraphql = (lecture: GraphqlTalk): Talk => ({
  guid: lecture.guid,
  slug: lecture.slug,
  title: lecture.title,
  description: lecture.description,
  duration: lecture.duration,
  viewCount: lecture.viewCount,
  persons: lecture.persons || [],
  conference_title: lecture.conference && lecture.conference.title,
  images: lecture.images || {},
  videos: (lecture.videos || []).map((video) => ({ ...video, language: video.language || lecture.originalLanguage || 'eng' })),
  subtitles: (lecture.subtitles || []).map((subtitle) => ({ ...subtitle, language: subtitle.language || 'eng' })),
});

export const fromRest = (event: RestTalk): Talk => ({
  guid: event.guid,
  slug: event.slug,
  title: event.title,
  description: event.description,
  duration: event.length || event.duration || 0,
  viewCount: event.view_count,
  persons: event.persons || [],
  conference_title: event.conference_title,
  images: { thumbUrl: event.thumb_url, posterUrl: event.poster_url },
  videos: (event.recordings || [])
    .filter((r) => r.mime_type && r.mime_type.includes('video'))
    .map((r) => ({ url: r.recording_url, mimeType: r.mime_type, language: r.language || event.original_language || 'eng', width: r.width, height: r.height })),
  subtitles: (event.recordings || [])
    .filter((r) => r.mime_type && /vtt|subrip/i.test(r.mime_type))
    .map((r) => ({ url: r.recording_url, mimeType: r.mime_type, language: r.language || 'eng' })),
});

