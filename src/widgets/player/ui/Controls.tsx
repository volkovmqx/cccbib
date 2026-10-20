import type { PlayerButton, Focus } from '../model/types';
import React from 'react';
import { ProgressBar } from './ProgressBar';

const GROUPS = ['left', 'center', 'right'];

export const Controls = React.memo(function Controls({ title, subTitle, buttons, focus, video, onSeek }: { title: string; subTitle?: string | null; buttons: PlayerButton[]; focus: Focus; video: HTMLVideoElement | null; onSeek: (seconds: number) => void }) {
  return (
    <div className="playerUI">
      <div className="playerUI__cover" />
      <div className="playerUI__meta">
        <div className="playerUI__title">{title}</div>
        <div className="playerUI__subtitle">{subTitle}</div>
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
                {button.icon}
              </button>
            ))}
          </div>
        ))}
      </div>
      <ProgressBar video={video} focused={focus.area === 'progress'} onSeek={onSeek} />
    </div>
  );
});
