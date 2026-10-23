import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Talk } from '@/entities/talk';
import type { useControlsVisibility } from './useControlsVisibility';

export type Selector = 'language' | 'subtitle' | 'aspect';
export interface Focus { area: 'none' | 'buttons' | 'progress' | 'back'; id: string | null }
export interface PlayerButton {
  id: string;
  align: string;
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}
export interface PlayerProps { event: Talk; conferenceTitle?: string; onClose: () => void; startAt?: number }
export interface NowPlaying { event: Talk; playing: boolean; position: number; duration: number }
export interface KeyboardContext {
  onClose: () => void;
  controls: ReturnType<typeof useControlsVisibility>;
  selector: Selector | null;
  selectorLength: number;
  selectorIndex: number;
  setSelectorIndex: Dispatch<SetStateAction<number>>;
  openSelector: (name: Selector) => void;
  confirmSelector: (index: number) => void;
  closeSelector: () => void;
  buttons: PlayerButton[];
  backButton: boolean;
  hasMultipleLanguages: boolean;
  hasSubtitles: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  seek: (seconds: number) => void;
  toggleMute: () => void;
}
