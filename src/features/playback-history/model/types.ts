import type { Talk } from '@/entities/talk';

export interface PlaybackHistoryItem {
  event: Talk;
  conferenceTitle: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
}

export type ProgressInput = Pick<PlaybackHistoryItem, 'event' | 'positionSeconds' | 'durationSeconds'>
  & Partial<Pick<PlaybackHistoryItem, 'conferenceTitle'>>;
