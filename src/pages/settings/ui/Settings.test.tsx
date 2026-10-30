import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import Settings from './Settings';
import { getSetting, setSetting } from '@/shared/config';
import { LOADER_STYLES, SETTING_DEFAULTS, SPINNER_STYLES, THEME_MODES } from '@/shared/config/constants';
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

test('settings content keeps the normal wheel scrolling while the tabs are stepped through', () => {
  const view = render(<Settings {...callbacks()} />);
  expect(view.container.querySelector('.settingsView__content')).toHaveAttribute('data-wheel', 'scroll');
  expect(view.container.querySelector('.settingsView__tabs')).not.toHaveAttribute('data-wheel');
});

test('going back to the content from the tabs or the side menu returns to the row you left without scrolling', () => {
  const view = render(<Settings {...callbacks()} />);
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView);
  const key = (name: string) => fireEvent.keyDown(window, { key: name });
  key('ArrowRight'); key('ArrowDown'); key('ArrowDown');
  const rows = [...view.container.querySelectorAll('.settingsView__row')];
  expect(rows[2]).toHaveClass('settingsView__row--focused');
  key('ArrowLeft');
  expect(view.container.querySelector('.settingsView__tab--focused')).toBeInTheDocument();
  expect(rows[2]).not.toHaveClass('settingsView__row--focused');
  scroll.mockClear();
  key('ArrowRight');
  expect(rows[2]).toHaveClass('settingsView__row--focused');
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  key('ArrowLeft'); key('Enter');
  expect(rows[2]).toHaveClass('settingsView__row--focused');
  fireEvent.click(view.container.querySelectorAll('.settingsView__tab')[1]);
  key('ArrowRight');
  expect(view.container.querySelector('.settingsView__row--focused')).toHaveTextContent('Text Size');
});

test('every setting with more than four options is chosen in a popup, the others stay in one line', () => {
  const view = render(<Settings {...callbacks()} />);
  const popups: string[] = [];
  for (const tab of [...view.container.querySelectorAll('.settingsView__tab')]) {
    fireEvent.click(tab);
    for (const row of [...view.container.querySelectorAll('.settingsView__row')]) {
      const segments = row.querySelectorAll('.settingsView__segment').length;
      expect(segments, row.textContent ?? '').toBeLessThanOrEqual(4);
      if (row.querySelector('.settingsView__select')) popups.push(row.querySelector('.settingsView__rowName')!.textContent!);
    }
  }
  for (const name of ['Theme', 'Button Style', 'Border Width', 'Startup Animation', 'Loading Animation', 'Text Size', 'Accent Color', 'Font']) expect(popups).toContain(name);
  for (const name of ['Corners', 'Indicator', 'Icon Color']) expect(popups).not.toContain(name);
});

test('theme, border width, and animations are previewed in their popups', () => {
  const view = render(<Settings {...callbacks()} />);
  const preview = (title: string, selector: string, count: number) => {
    const row = screen.getByText(title).closest('.settingsView__row')!;
    expect(row.querySelector(`.settingsView__select ${selector}`), title).toBeInTheDocument();
    fireEvent.click(row.querySelector('.settingsView__select')!);
    const items = [...view.container.querySelectorAll('.picker__item')];
    expect(items).toHaveLength(count);
    for (const item of items) expect(item.querySelector(selector), title).toBeInTheDocument();
    fireEvent.click(view.container.querySelector('.picker__overlay')!);
  };
  preview('Theme', '.settingsView__btnPreview', THEME_MODES.length);
  preview('Border Width', '.settingsView__borderPreview', 7);
  preview('Startup Animation', '.settingsView__loaderPreview', LOADER_STYLES.length);
  preview('Loading Animation', '.settingsView__loaderPreview', SPINNER_STYLES.length);
  const row = screen.getByText('Theme').closest('.settingsView__row')!;
  fireEvent.click(row.querySelector('.settingsView__select')!);
  fireEvent.click([...view.container.querySelectorAll('.picker__item')].find(item => /Light$/.test(item.textContent ?? ''))!);
  expect(getSetting('themeMode')).toBe('light');
  expect(row.querySelector('.settingsView__select')).toHaveTextContent('Light');
});

test('button style is chosen in a popup that previews every style', () => {
  const view = render(<Settings {...callbacks()} />);
  const row = screen.getByText('Button Style').closest('.settingsView__row')!;
  expect(row.querySelectorAll('.settingsView__segment')).toHaveLength(0);
  const select = row.querySelector('.settingsView__select')!;
  expect(select).toHaveTextContent('Accent');
  expect(select.querySelector('.settingsView__btnPreview')).toBeInTheDocument();
  fireEvent.click(select);
  const items = [...view.container.querySelectorAll('.picker__item')];
  expect(items).toHaveLength(8);
  for (const item of items) expect(item.querySelector('.settingsView__btnPreview')).toBeInTheDocument();
  expect(items[0]).toHaveClass('picker__item--current');
  fireEvent.click(items[1]);
  expect(getSetting('buttonStyle')).toBe('inverted');
  expect(view.container.querySelector('.picker')).not.toBeInTheDocument();
  expect(row.querySelector('.settingsView__select')).toHaveTextContent('Inverted');
});

test('a row focused by the pointer is not scrolled to the centre but one focused by the keys is', () => {
  const view = render(<Settings {...callbacks()} />);
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView);
  const rows = [...view.container.querySelectorAll('.settingsView__row')];
  fireEvent.mouseMove(rows[3], { clientX: 201, clientY: 301 });
  expect(rows[3]).toHaveClass('settingsView__row--focused');
  expect(scroll).not.toHaveBeenCalled();
  fireEvent.mouseMove(rows[3], { clientX: 202, clientY: 302 });
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(rows[4]).toHaveClass('settingsView__row--focused');
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
});

test('settings follow a moving pointer over tabs, rows, options, and the picker', () => {
  const view = render(<Settings {...callbacks()} />);
  const move = (element: Element, x: number) => fireEvent.mouseMove(element, { clientX: x, clientY: 5 });
  const tabs = [...view.container.querySelectorAll('.settingsView__tab')];
  move(tabs[1], 101);
  expect(tabs[1]).toHaveClass('settingsView__tab--active');
  expect(tabs[1]).toHaveClass('settingsView__tab--focused');
  move(tabs[1], 102);
  fireEvent.click(tabs[0]);
  const indicator = screen.getByText('Indicator').closest('.settingsView__row')!;
  move(indicator, 103);
  expect(indicator).toHaveClass('settingsView__row--focused');
  expect(tabs[0]).not.toHaveClass('settingsView__tab--focused');
  const border = [...indicator.querySelectorAll('.settingsView__segment')].find(option => option.textContent === 'Border')!;
  move(border, 104);
  expect(border).toHaveClass('settingsView__control--focused');
  move(indicator, 105);
  expect(indicator.querySelector('.settingsView__control--focused')).toHaveTextContent('Line');
  fireEvent.click(screen.getByText('Font').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  const items = [...view.container.querySelectorAll('.picker__item')];
  move(items[2], 106);
  expect(items[2]).toHaveClass('picker__item--selected');
  move(items[2], 107);
  expect(items[2]).toHaveClass('picker__item--selected');
  fireEvent.click(view.container.querySelector('.picker__overlay')!);
  fireEvent.click(screen.getByText('Accent Color').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  const swatches = [...view.container.querySelectorAll('.picker__swatch')];
  move(swatches[3], 108);
  expect(swatches[3]).toHaveClass('picker__swatch--selected');
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

test('the font popup shows each font at its own size factor so the list looks even', () => {
  const view = render(<Settings {...callbacks()} />);
  fireEvent.click(screen.getByText('Font').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  expect(view.container.querySelector('.picker__list')).toHaveAttribute('data-wheel', 'scroll');
  const label = (name: string) => [...view.container.querySelectorAll<HTMLElement>('.picker__itemLabel span')].find((span) => span.textContent === name)!;
  expect(label('VT323').style.fontSize).toBe('1.15em');
  expect(label('Silkscreen').style.fontSize).toBe('0.85em');
  expect(label('Inter').style.fontSize).toBe('');
});

test('the subtitle font starts with App, which follows the app font, and the app font has no such entry', () => {
  const view = render(<Settings {...callbacks()} />);
  const names = () => [...view.container.querySelectorAll('.picker__itemLabel span')].map((span) => span.textContent);
  const openFont = () => fireEvent.click(screen.getByText('Font').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  openFont();
  expect(names()).not.toContain('App');
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click([...view.container.querySelectorAll('.settingsView__tab')].find((tab) => tab.textContent!.includes('Subtitles'))!);
  openFont();
  expect(names().slice(0, 3)).toEqual(['App', 'System', 'Inconsolata']);
  expect(view.container.querySelector<HTMLElement>('.picker__itemLabel span')!.style.fontFamily).toBe('');
  fireEvent.click(view.container.querySelector('.picker__item')!);
  expect(getSetting('subtitleFont')).toBe('app');
});

test('the scrollbar row offers normal, large and hidden and stores the choice', () => {
  render(<Settings {...callbacks()} />);
  const row = screen.getByText('Scrollbar').closest('.settingsView__row') as HTMLElement;
  for (const name of ['Normal', 'Large', 'Hidden']) expect(within(row).getByText(name)).toBeInTheDocument();
  expect(getSetting('scrollbarSize')).toBe('normal');
  fireEvent.click(within(row).getByText('Large'));
  expect(getSetting('scrollbarSize')).toBe('large');
  fireEvent.click(within(row).getByText('Hidden'));
  expect(getSetting('scrollbarSize')).toBe('hidden');
});

test('the screen filter row offers the still filters and the Pulse and stores the choice', () => {
  const view = render(<Settings {...callbacks()} />);
  const row = screen.getByText('Screen Filter').closest('.settingsView__row') as HTMLElement;
  expect(getSetting('scanlines')).toBe('off');
  fireEvent.click(row.querySelector('.settingsView__select')!);
  expect([...view.container.querySelectorAll('.picker__item')].map((item) => item.textContent)).toEqual(['Off', 'Lines', 'Grille', 'Trinitron', 'Pixel Grid', 'Dots', 'Tube', 'Pulse']);
  fireEvent.click(screen.getByText('Trinitron'));
  expect(getSetting('scanlines')).toBe('trinitron');
  fireEvent.click(row.querySelector('.settingsView__select')!);
  fireEvent.click(screen.getByText('Pulse'));
  expect(getSetting('scanlines')).toBe('pulse');
});

test('the playback speed row offers seven speeds and stores the choice', () => {
  const view = render(<Settings {...callbacks()} />);
  fireEvent.click(screen.getByText('Playback', { selector: '.settingsView__tab *, .settingsView__tab' }));
  const row = screen.getByText('Playback Speed').closest('.settingsView__row') as HTMLElement;
  expect(row).toHaveTextContent('1\u00d7');
  fireEvent.click(row.querySelector('.settingsView__select')!);
  const items = [...view.container.querySelectorAll('.picker__item')].map((item) => item.textContent);
  expect(items).toEqual(['0.5\u00d7', '0.75\u00d7', '1\u00d7', '1.25\u00d7', '1.5\u00d7', '1.75\u00d7', '2\u00d7']);
  expect(getSetting('playbackSpeed')).toBe(1);
  fireEvent.click(screen.getByText('1.5\u00d7'));
  expect(getSetting('playbackSpeed')).toBe(1.5);
});

test('the rows of a tab wrap around: Down on the last row goes to the first and Up on the first goes to the last', () => {
  const view = render(<Settings {...callbacks()} />);
  const key = (name: string) => fireEvent.keyDown(window, { key: name });
  key('ArrowRight');
  const rows = [...view.container.querySelectorAll('.settingsView__row')];
  const focused = () => rows.findIndex((row) => row.classList.contains('settingsView__row--focused'));
  expect(focused()).toBe(0);
  key('ArrowUp');
  expect(focused()).toBe(rows.length - 1);
  key('ArrowDown');
  expect(focused()).toBe(0);
  for (let step = 0; step < rows.length - 1; step += 1) key('ArrowDown');
  expect(focused()).toBe(rows.length - 1);
  key('ArrowDown');
  expect(focused()).toBe(0);
});

test('a picker list wraps around, and a picker grid wraps within its column even when the last row is not full', () => {
  const view = render(<Settings {...callbacks()} />);
  const key = (name: string) => fireEvent.keyDown(window, { key: name });
  const selectedIn = (selector: string, selected: string) => [...view.container.querySelectorAll(selector)].findIndex((item) => item.classList.contains(selected));

  fireEvent.click(screen.getByText('Theme').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  const count = view.container.querySelectorAll('.picker__item').length;
  const at = () => selectedIn('.picker__item', 'picker__item--selected');
  for (let guard = 0; guard < count && at() !== count - 1; guard += 1) key('ArrowDown');
  expect(at()).toBe(count - 1);
  key('ArrowDown'); expect(at()).toBe(0);
  key('ArrowUp'); expect(at()).toBe(count - 1);
  fireEvent.click(view.container.querySelector('.picker__overlay')!);

  fireEvent.click(screen.getByText('Accent Color').closest('.settingsView__row')!.querySelector('.settingsView__select')!);
  (view.container.querySelector('.picker__grid') as HTMLElement).style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr';
  const swatches = view.container.querySelectorAll('.picker__swatch').length;
  const swatch = () => selectedIn('.picker__swatch', 'picker__swatch--selected');
  expect(swatches % 5).not.toBe(0);
  while (swatch() >= 5) key('ArrowUp');
  const column = swatch();
  key('ArrowUp');
  const lastInColumn = (value: number) => { let found = value; for (let index = value; index < swatches; index += 5) found = index; return found; };
  expect(swatch()).toBe(lastInColumn(column));
  key('ArrowDown');
  expect(swatch()).toBe(column);
  key('ArrowRight'); key('ArrowUp');
  expect(swatch()).toBe(lastInColumn(column + 1));
});

test('the tab list wraps around from its last tab to the first and back', () => {
  render(<Settings {...callbacks()} />);
  const key = (name: string) => fireEvent.keyDown(window, { key: name });
  const active = () => document.querySelector('.settingsView__tab--active')!.textContent;
  key('ArrowUp');
  expect(active()).toContain('Data & About');
  key('ArrowDown');
  expect(active()).toContain('Appearance');
  for (let index = 0; index < 4; index++) key('ArrowDown');
  expect(active()).toContain('Data & About');
});

test.each([[false, 0], [true, 1]])('the menu position row only shows on a small screen: %s', (small, count) => {
  vi.stubGlobal('matchMedia', () => ({ matches: small, addListener: vi.fn(), removeListener: vi.fn() }));
  const view = render(<Settings {...callbacks()} />);
  expect([...view.container.querySelectorAll('.settingsView__rowName')].filter((name) => name.textContent === 'Menu Position')).toHaveLength(count);
  if (small) {
    const row = [...view.container.querySelectorAll('.settingsView__row')].find((item) => item.textContent?.startsWith('Menu Position'))!;
    fireEvent.click(within(row as HTMLElement).getByText('Bottom'));
    expect(getSetting('menuPosition')).toBe('bottom');
  }
  vi.unstubAllGlobals();
});

test('a select whose saved value is not among its options shows an empty name', () => {
  setSetting('themeMode', 'removed-theme' as never);
  const view = render(<Settings {...callbacks()} />);
  const row = screen.getByText('Theme').closest('.settingsView__row')!;
  expect(row.querySelector('.settingsView__selectName')).toHaveTextContent('');
  expect(view.container.querySelector('.settingsView__select')).toBeInTheDocument();
});

test('the keys move through button rows and select rows without changing a choice they do not have', () => {
  vi.useFakeTimers();
  const view = render(<Settings {...callbacks()} />);
  const key = (name: string) => fireEvent.keyDown(window, { key: name });
  for (let step = 0; step < 4; step++) key('ArrowDown');
  expect(view.container.querySelector('.settingsView__tab--active')).toHaveTextContent('Data & About');
  key('ArrowRight');
  key('ArrowRight');
  key('ArrowLeft');
  expect(view.container.querySelector('.settingsView__tab--focused')).toBeInTheDocument();
  key('ArrowRight');
  key('ArrowDown');
  key('Enter');
  expect(view.container.textContent).toContain('Watchlist cleared.');
  act(() => { vi.runOnlyPendingTimers(); });
  key('ArrowUp');
  key('Enter');
  expect(view.container.querySelector('.settingsView__tab--active')).toHaveTextContent('Data & About');
  for (let step = 0; step < 4; step++) { key('ArrowLeft'); key('ArrowUp'); }
  key('ArrowRight');
  key('ArrowDown');
  key('ArrowRight');
  key('ArrowLeft');
  key('ArrowLeft');
  expect(view.container.querySelector('.settingsView__tab--focused')).toBeInTheDocument();
});
