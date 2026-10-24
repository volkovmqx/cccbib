import type { PlayerButton, Focus } from '../model/types';
import React from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { useSetting } from '@/shared/config';
import { ProgressBar } from './ProgressBar';
import { ButtonIcon, osdIcon } from './osdIcon';

const GROUPS = ['left', 'center', 'right'];

export const Controls = React.memo(function Controls({ title, buttons, back, focus, video, visible = true, onSeek }: { title: string; buttons: PlayerButton[]; back?: { label: string; onPress: () => void }; focus: Focus; video: HTMLVideoElement | null; visible?: boolean; onSeek: (seconds: number) => void }) {
  const [iconVariant] = useSetting('iconVariant');
  const backIcon = osdIcon(iconVariant, IconArrowLeft);
  return (
    <div className="playerUI">
      <div className="playerUI__cover" />
      <div className="playerUI__top">
        {back && (
          <button
            type="button"
            aria-label={back.label}
            className={`playerUI__button playerUI__back ${focus.area === 'back' ? 'playerUI__button--focused' : ''}`}
            onClick={back.onPress}
          >
            <ButtonIcon {...backIcon} />
          </button>
        )}
        <div className="playerUI__meta">
          <div className="playerUI__title">{title}</div>
        </div>
      </div>
      <div className="playerUI__buttons">
        {GROUPS.map((group) => (
          <div key={group} className={`playerUI__group playerUI__group--${group}`}>
            {buttons.filter((button) => button.align === group).map((button) => (
              <button
                key={button.id}
                type="button"
                aria-label={button.label}
                disabled={button.disabled}
                className={`playerUI__button ${focus.area === 'buttons' && focus.id === button.id ? 'playerUI__button--focused' : ''}`}
                onClick={button.onPress}
              >
                <ButtonIcon icon={button.icon} activeIcon={button.activeIcon} />
              </button>
            ))}
          </div>
        ))}
      </div>
      <ProgressBar video={video} focused={focus.area === 'progress'} visible={visible} onSeek={onSeek} />
    </div>
  );
});
