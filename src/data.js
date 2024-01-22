
import { gql } from '@apollo/client';

export const GET_RECENT_CONFERENCES = gql`
  query conferencesRecent($offset: Int) {
        conferencesRecent(offset: $offset, first: 3) {
          id
          title
          slug
          logoUrl
          aspectRatio
          scheduleUrl
          updatedAt
          eventLastReleasedAt
          lectures  {
            nodes {
              guid
              title
              persons
              duration
              viewCount
              images {
                posterUrl
              }
              videos {
                width
                mimeType
                language
                url
              }
            }
          }
        }
      }
`;



export const GET_LECTURE = gql`
  query lecture ($id: ID!) {
    lecture(guid: $id) {
      title
      description
      videos {
        highQuality
        mimeType
        url
        language
      }        
    }
  }
`;