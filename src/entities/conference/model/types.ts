import type { Talk } from '@/entities/talk/@x/conference';

export interface Conference {
  id?: string;
  updatedAt?: string;
  eventLastReleasedAt?: string;
  title: string;
  lectures: { nodes: Talk[] };
}

export interface RecentData {
  conferencesRecent: Conference[];
  fetched?: number;
}

export interface ConferenceSummary {
  title: string;
  acronym: string;
  logo_url?: string;
  updated_at?: string;
  event_last_released_at?: string;
}
