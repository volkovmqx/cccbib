export type CommandName = 'play' | 'add' | 'remove' | 'progress' | 'progress-set' | 'progress-clear'
  | 'pause' | 'resume' | 'toggle' | 'seek' | 'mute' | 'aspect' | 'speed' | 'subtitle' | 'language' | 'stop';

export interface RemoteCommand {
  cmd: CommandName;
  link?: unknown;
  links?: unknown[];
  items?: unknown[];
  position?: unknown;
  percent?: unknown;
  start?: number;
  to?: number;
  by?: number;
  value?: string | number | boolean;
  aspect?: string;
  subtitle?: string;
  language?: string;
}

export interface CommandItem {
  link: string | null;
  position?: number;
  percent?: number;
}
