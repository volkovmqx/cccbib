import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import Settings from './Settings';
import { getSetting, setSetting } from '@/shared/config';
import { SETTING_DEFAULTS } from '@/shared/config/constants';
import type { SettingKey } from '@/shared/config';

const callbacks = () => ({ onClose: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false });
beforeEach(() => {
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) setSetting(key, SETTING_DEFAULTS[key]);
  setSetting('uiLanguage', 'en');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('settings expose and persist all option controls', () => {
  const view = render(<Settings {...callbacks()} />);
  const tabs = [...view.container.querySelectorAll('.settingsView__tab')];
  for (const tab of tabs.slice(0, -1)) {
    fireEvent.click(tab);
    for (const row of [...view.container.querySelectorAll('.settingsView__row')]) {
      const select = row.querySelector('.settingsView__select');
      if (select) {
        fireEvent.click(select);
        const count = view.container.querySelectorAll('.picker__item, .picker__swatch').length;
        for (let index = 0; index < count; index++) {
          if (index > 0) fireEvent.click(select);
          const options = view.container.querySelectorAll('.picker__item, .picker__swatch');
          fireEvent.click(options[index]);
          expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
        }
      } else {
        for (const option of [...row.querySelectorAll('.settingsView__segment')]) fireEvent.click(option);
      }
      act(() => { setSetting('uiLanguage', 'en'); });
    }
  }
  expect(localStorage.getItem('subtitleBackground')).not.toBeNull();
  expect(getSetting('themeMode')).not.toBe(SETTING_DEFAULTS.themeMode);
}, 20000);

test('settings keyboard navigation respects focus, limits, and list pickers', () => {
  vi.useFakeTimers();
  const props = callbacks();
  const view = render(<Settings {...props} />);
  const key = (key: string, keyCode = 0) => fireEvent.keyDown(window, { key, keyCode });
  key('ArrowLeft'); expect(props.onFocusSidebar).toHaveBeenCalled();
  key('Escape'); expect(props.onClose).toHaveBeenCalled();
  key('ArrowUp'); key('ArrowDown');
  key('ArrowRight');
  key('ArrowUp'); key('ArrowLeft');
  key('Enter'); key('Enter');
  expect(view.container.querySelector('.picker')).toBeInTheDocument();
  key('ArrowDown'); key('ArrowUp'); key('Enter');
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
  key('Enter'); key('Escape');
  key('Enter'); key('ArrowLeft');
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
  key('ArrowDown');
  for (let index = 0; index < 8; index++) key('ArrowRight');
  key('ArrowLeft'); key('Enter');
  expect(localStorage.getItem('themeMode')).not.toBeNull();
  for (let index = 0; index < 20; index++) key('ArrowDown');
  for (let index = 0; index < 20; index++) key('ArrowUp');
  key('Escape');
  view.rerender(<Settings {...props} sidebarFocused />);
  key('Escape'); expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('settings swatch picker navigates a grid and closes by its overlay', () => {
  const view = render(<Settings {...callbacks()} />);
  const row = screen.getByText('Accent Color').closest('.settingsView__row')!;
  fireEvent.click(row.querySelector('.settingsView__select')!);
  (view.container.querySelector('.picker__grid') as HTMLElement).style.gridTemplateColumns = '1fr 1fr 1fr';
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowLeft']) fireEvent.keyDown(window, { key });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
  fireEvent.click(row.querySelector('.settingsView__select')!);
  fireEvent.click(view.container.querySelector('.picker__overlay')!);
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
});

test('settings show conditional glass controls and clear only the requested stored data', () => {
  vi.useFakeTimers();
  setSetting('railStyle', 'glass');
  localStorage.setItem('watchlist', '[{}]');
  localStorage.setItem('continue_watching', '{}');
  localStorage.setItem('home_cache_v1', '[]');
  localStorage.setItem('playback_position_talk', '100');
  localStorage.setItem('unrelated', 'keep');
  const view = render(<Settings {...callbacks()} />);
  expect(screen.getByText('Glass Transparency')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Data & About'));
  expect(view.container.textContent).toContain('org.webosbrew.cccbib test');
  const clearWatchlist = screen.getByText('Clear Watchlist').closest('.settingsView__row')!;
  fireEvent.click(clearWatchlist.querySelector('.settingsView__segment')!);
  expect(localStorage.getItem('watchlist')).toBeNull();
  expect(localStorage.getItem('continue_watching')).not.toBeNull();
  expect(view.container.textContent).toContain('Watchlist cleared.');
  act(() => { vi.advanceTimersByTime(3000); });
  expect(view.container.textContent).not.toContain('Watchlist cleared.');
  const clearCache = screen.getByText('Clear Cache').closest('.settingsView__row')!;
  fireEvent.click(clearCache.querySelector('.settingsView__segment')!);
  expect(localStorage.getItem('continue_watching')).toBeNull();
  expect(localStorage.getItem('playback_position_talk')).toBeNull();
  expect(localStorage.getItem('home_cache_v1')).toBeNull();
  expect(localStorage.getItem('unrelated')).toBe('keep');
});
