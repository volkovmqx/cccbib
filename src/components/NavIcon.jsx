import React from 'react';
import {
  IconSearch, IconSearchFilled, IconHome, IconHomeFilled, IconTrendingUp, IconLayoutGrid, IconLayoutGridFilled,
  IconBookmark, IconBookmarkFilled, IconSettings, IconSettingsFilled, IconPalette, IconPaletteFilled, IconTextSize,
  IconPlayerPlay, IconPlayerPlayFilled, IconBadgeCc, IconBadgeCcFilled, IconInfoCircle, IconInfoCircleFilled,
} from '@tabler/icons-react';

const PAIRS = {
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

export const isFilled = (variant, active) => variant === 'filled' || (variant === 'dynamic' && active);

export const NavIcon = ({ name, filled, size }) => {
  const [Outlined, Solid] = PAIRS[name];
  if (filled && Solid) return <Solid size={size} />;
  return <Outlined size={size} stroke={filled ? 2.8 : 2} />;
};
