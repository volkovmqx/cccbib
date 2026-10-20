export const GET_LECTURE_SUBTITLES = `
  query lectureSubtitles($guid: ID!) {
    lecture(guid: $guid) {
      guid
      subtitles {
        mimeType
        language
        url
      }
    }
  }
`;

export const SEARCH_LECTURES = `
  query lectureSearch($q: String!) {
    lectureSearch(query: $q, page: 1) {
      guid
      slug
      title
      persons
      duration
      description
      viewCount
      originalLanguage
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
      conference {
        title
      }
    }
  }
`;

