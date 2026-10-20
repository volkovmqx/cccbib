import {
  IconSearch, IconSearchFilled, IconHome, IconHomeFilled, IconTrendingUp, IconLayoutGrid, IconLayoutGridFilled,
  IconBookmark, IconBookmarkFilled, IconSettings, IconSettingsFilled, IconPalette, IconPaletteFilled, IconTextSize,
  IconPlayerPlay, IconPlayerPlayFilled, IconBadgeCc, IconBadgeCcFilled, IconInfoCircle, IconInfoCircleFilled,
} from '@tabler/icons-react';

const PAIRS: Record<string, [typeof IconSearch, typeof IconSearch | null]> = {
  search: [IconSearch, IconSearchFilled],
  recent: [IconHome, IconHomeFilled],
  popular: [IconTrendingUp, null],
  events: [IconLayoutGrid, IconLayoutGridFilled],
  watchlist: [IconBookmark, IconBookmarkFilled],
  settings: [IconSettings, IconSettingsFilled],
  appearance: [IconPalette, IconPaletteFilled],
  display: [IconTextSize, null],
  playback: [IconPlayerPlay, IconPlayerPlayFilled],
  subtitles: [IconBadgeCc, IconBadgeCcFilled],
  about: [IconInfoCircle, IconInfoCircleFilled],
};

export const isFilled = (variant: string, active: boolean) => variant === 'filled' || (variant === 'dynamic' && active);

export const NavIcon = ({ name, filled, size }: { name: string; filled: boolean; size?: number | string }) => {
  const [Outlined, Solid] = PAIRS[name];
  if (filled && Solid) return <Solid size={size} />;
  return <Outlined size={size} stroke={filled ? 2.8 : 2} />;
};
