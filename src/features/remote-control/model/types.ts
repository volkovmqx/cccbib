export type CommandName = 'play' | 'add' | 'remove' | 'progress' | 'progress-set' | 'progress-clear' | 'mqtt'
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
  url?: string;
  username?: string;
  password?: string;
}

export interface CommandItem {
  link: string | null;
  position?: number;
  percent?: number;
}
