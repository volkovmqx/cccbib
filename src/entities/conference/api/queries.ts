import type { Conference, RecentData } from '../model/types';

const CONFERENCE_HEAD = `
  id
  title
  updatedAt
  eventLastReleasedAt
`;

const LECTURE_FIELDS = `
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
        size
      }
      subtitles {
        mimeType
        language
        url
      }
`;

const CONFERENCE_FIELDS = `
  ${CONFERENCE_HEAD}
  lectures {
    nodes {
      ${LECTURE_FIELDS}
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

// The API sends 50 talks per request, whatever is asked for, and the cursor of one page opens the next
export const GET_CONFERENCE = `
  query conference($id: ID!, $after: String) {
    conference(id: $id) {
      ${CONFERENCE_HEAD}
      lectures(after: $after) {
        nodes {
          ${LECTURE_FIELDS}
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const RECENT_KEY = 'recent';

// The API pages by offset, so a talk can come on two pages, talks are unique by guid
export function mergeLectures(existing: { conference: Conference } | undefined, incoming: { conference: Conference }) {
  if (!existing) return incoming;
  const known = new Set(existing.conference.lectures.nodes.map((talk) => talk.guid));
  const added = incoming.conference.lectures.nodes.filter((talk) => !known.has(talk.guid));
  const { nodes } = existing.conference.lectures;
  return { conference: { ...existing.conference, lectures: { nodes: [...nodes, ...added], pageInfo: incoming.conference.lectures.pageInfo } } };
}

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
