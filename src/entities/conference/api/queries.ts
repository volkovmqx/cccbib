import type { Conference, RecentData } from '../model/types';

const CONFERENCE_FIELDS = `
  id
  title
  updatedAt
  eventLastReleasedAt
  lectures {
    nodes {
      guid
      slug
      title
      persons
      duration
      description
      viewCount
      images {
        thumbUrl
        posterUrl
      }
      videos {
        width
        height
        mimeType
        language
        url
      }
      subtitles {
        mimeType
        language
        url
      }
    }
  }
`;

export const GET_RECENT_CONFERENCES = `
  query conferencesRecent($offset: Int) {
    conferencesRecent(offset: $offset, first: 6) {
      ${CONFERENCE_FIELDS}
    }
  }
`;

export const GET_CONFERENCE = `
  query conference($id: ID!) {
    conference(id: $id) {
      ${CONFERENCE_FIELDS}
    }
  }
`;

export const RECENT_KEY = 'recent';

// The API pages by offset, so the same conference can show up on two pages, rows are unique by id
export function mergeRecent(existing: RecentData | undefined, incoming: RecentData, offset = 0): RecentData {
  const page = incoming.conferencesRecent;
  const pageIds = new Set(page.map((conference) => conference.id));
  const previous = existing ? existing.conferencesRecent : [];
  const seen = new Set();
  const unique = (list: Conference[]) => list.filter((conference) => {
    if (seen.has(conference.id)) return false;
    seen.add(conference.id);
    return true;
  });

  const merged = offset === 0
    ? unique([...page, ...previous.filter((conference) => !pageIds.has(conference.id))])
    : unique([...previous, ...page]);
  const fetched = Math.max(existing && existing.fetched ? existing.fetched : previous.length, offset + page.length);
  return { conferencesRecent: merged, fetched };
}
