export interface Recording {
  url: string;
  mimeType: string;
  language: string;
  width?: number;
  height?: number;
}

export interface SubtitleSource {
  url: string;
  mimeType: string;
  language: string;
}

export interface Talk {
  guid: string;
  slug?: string;
  title: string;
  description?: string;
  duration: number;
  viewCount?: number;
  persons: string[];
  conference_title?: string;
  images: { thumbUrl?: string; posterUrl?: string };
  videos: Recording[];
  subtitles?: SubtitleSource[];
  detailsChecked?: boolean;
}

export interface RestRecording {
  recording_url: string;
  mime_type: string;
  language?: string;
  width?: number;
  height?: number;
}

export interface RestTalk {
  guid: string;
  slug?: string;
  title: string;
  description?: string;
  length?: number;
  duration?: number;
  view_count?: number;
  persons?: string[];
  conference_title?: string;
  original_language?: string;
  thumb_url?: string;
  poster_url?: string;
  recordings?: RestRecording[];
}

export interface GraphqlTalk extends Omit<Talk, 'persons' | 'videos'> {
  persons?: string[];
  videos?: Recording[];
  originalLanguage?: string;
  conference?: { title: string };
}
