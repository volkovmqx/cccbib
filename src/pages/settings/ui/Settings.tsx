import type { PageProps } from '@/shared/ui';
import type { Settings as SettingsValues, SettingKey } from '@/shared/config';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { pointerMoved, useWindowEvent } from '@/shared/lib';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { NavIcon, isFilled } from '@/shared/ui';
import {
  LANGUAGES, UI_LANGUAGES, SUBTITLE_LANGUAGES, SUBTITLE_SIZES, SUBTITLE_COLORS, SUBTITLE_BACKGROUNDS, PREVIEW_VIDEO_OPTIONS, REMOTE_CONTROL_OPTIONS,
  THEME_MODES, ACCENT_COLORS, UI_FONTS, SUBTITLE_FONTS, LOADER_STYLES, SPINNER_STYLES, RAIL_STYLES, GLASS_SHEEN, GLASS_TRANSPARENCY, MENU_COLORS, NAV_INDICATORS, ICON_VARIANTS, LOGO_BUTTONS, MENU_POSITIONS, BUTTON_STYLES, CORNER_STYLES, BORDER_WIDTHS, SCROLLBAR_SIZES, SCALE_OPTIONS, TEXT_SCALE_OPTIONS, OSD_SCALE_OPTIONS, OSD_OPACITY_OPTIONS, OSD_MENU_OPACITY_OPTIONS, OSD_HANDLES, OSD_BAR_COLORS, OSD_TIME_MODES, OSD_BUTTON_SHAPES, OSD_IDLE_BUTTONS, OSD_BACK_BUTTONS, STATS_OPTIONS, ASPECT_RATIOS,
} from '@/shared/config';
import { revealInList, scrollIntoView, useMediaQuery } from '@/shared/lib';
import { PLAYBACK_HISTORY_KEY } from '@/features/playback-history';
import { clearHomeCache } from '@/entities/conference';
import { getSetting, setSetting, useSetting } from '@/shared/config';
import { Spinner } from '@/shared/ui';
import { AboutCat } from './AboutCat';
import { useTranslation } from '@/shared/i18n';
import { buttonColors, paletteFor } from '@/shared/config';

interface Option { code: string | number; name: string; native?: boolean; family?: string | null; scale?: number; radii?: number[] }
interface RowBase { title: string; description: string; showWhen?: Partial<SettingsValues>; compactOnly?: boolean; variant?: string }
type Row = RowBase & ({ action: true; key: 'clearCache' | 'clearWatchlist'; button: string; options?: never }
  | { action?: false; key: SettingKey; options: Option[]; button?: never });
type IndexedRow = Row & { index: number };
interface Group { title: string; preview?: boolean; rows: Row[] }
interface Tab { id: string; label: string; iconName: string; groups: Group[]; about?: boolean; rows?: Row[] }















const TABS: Tab[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    iconName: 'appearance',
    groups: [
      {
        title: 'Look',
        rows: [
          { key: 'uiLanguage', title: 'App Language', description: 'Language of menus and settings. Auto follows the language of your TV.', options: UI_LANGUAGES },
          { key: 'themeMode', title: 'Theme', description: 'The background style of the app.', options: THEME_MODES, variant: 'theme' },
          { key: 'accentColor', title: 'Accent Color', description: 'The highlight color used across the app.', options: ACCENT_COLORS, variant: 'swatch' },
          { key: 'uiFont', title: 'Font', description: 'The font used across the app.', options: UI_FONTS, variant: 'font' },
          { key: 'scrollbarSize', title: 'Scrollbar', description: 'The scrollbar of lists and pages. It shows while you scroll and grows under the pointer. A large one stays visible and is easy to grab, or hide it completely.', options: SCROLLBAR_SIZES },
        ],
      },
      {
        title: 'Side Menu',
        rows: [
          { key: 'railStyle', title: 'Style', description: 'Plain blends into the page (pure black in the Black theme), Panel gives the menu its own background and Glass is translucent. Glass shows one more option below.', options: RAIL_STYLES },
          { key: 'glassSheen', title: 'Menu Shine', description: 'Shiny adds a soft glow behind the logo of the open menu and a light reflection on the Glass style. Flat keeps the menu plain.', options: GLASS_SHEEN },
          { key: 'glassTransparency', title: 'Glass Transparency', description: 'How much of the page shows through the open glass menu. On this TV the text behind it is not blurred, so Low stays the easiest to read.', options: GLASS_TRANSPARENCY, showWhen: { railStyle: 'glass' } },
          { key: 'menuPosition', title: 'Menu Position', description: 'Where the menu sits on phones and tablets. Bottom is easier to reach with a thumb and moves the Settings tabs to the bottom as well.', options: MENU_POSITIONS, compactOnly: true },
          { key: 'logoButton', title: 'Logo Button', description: 'The CCCBib logo can be the button for Settings or for Home. It then replaces the gear or the home icon, so it is never both. Off keeps it as decoration, except on phones and tablets where it is the Home button.', options: LOGO_BUTTONS },
          { key: 'iconVariant', title: 'Icon Variant', description: 'Dynamic shows outlined icons and fills the one you are on or focus. Applies to the side menu, the Settings tabs and the player controls.', options: ICON_VARIANTS },
          { key: 'menuIconColor', title: 'Icon Color', description: 'Color of the icons and names of the side menu items.', options: MENU_COLORS },
          { key: 'menuActiveColor', title: 'Selected Icon Color', description: 'Color of the item for the screen you are on.', options: MENU_COLORS },
          { key: 'navIndicator', title: 'Indicator', description: 'How the item of the screen you are on is marked in the side menu. Line is a bar on the left, Border frames the item and Contrast fills it with a contrasting color.', options: NAV_INDICATORS },
        ],
      },
      {
        title: 'Buttons',
        rows: [
          { key: 'buttonStyle', title: 'Button Style', description: 'Fill and text colors of the focused item, selected options and player buttons.', options: BUTTON_STYLES, variant: 'btnstyle' },
          { key: 'cornerStyle', title: 'Corners', description: 'How round buttons, tiles and panels are. Square gives the pixel look.', options: CORNER_STYLES, variant: 'corner' },
          { key: 'borderWidth', title: 'Border Width', description: 'Thickness of the outlines around tiles, list items and options. The selected one is outlined in the accent color.', options: BORDER_WIDTHS, variant: 'border' },
        ],
      },
      {
        title: 'Animations',
        rows: [
          { key: 'loaderStyle', title: 'Startup Animation', description: 'Shown once while the app starts.', options: LOADER_STYLES, variant: 'loader' },
          { key: 'spinnerStyle', title: 'Loading Animation', description: 'Shown whenever content loads inside the app. The ring is the lightest on older TVs.', options: SPINNER_STYLES, variant: 'loader' },
        ],
      },
    ],
  },
  {
    id: 'display',
    label: 'Size & Layout',
    iconName: 'display',
    groups: [
      {
        title: 'Scaling',
        rows: [
          { key: 'textScale', title: 'Text Size', description: 'Scale all text up or down.', options: TEXT_SCALE_OPTIONS },
          { key: 'tileScale', title: 'Tile Size', description: 'Scale the video tiles on the home screen. Smaller tiles show more rows.', options: SCALE_OPTIONS },
          { key: 'iconScale', title: 'Icon Size', description: 'Scale icons in the menu, on tiles, in the details and in the player.', options: SCALE_OPTIONS },
          { key: 'menuScale', title: 'Menu Size', description: 'Scale the side menu.', options: SCALE_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'playback',
    label: 'Playback',
    iconName: 'playback',
    groups: [
      {
        title: 'Language',
        rows: [
          { key: 'language', title: 'Audio Language', description: 'Preferred language for video playback when available.', options: LANGUAGES },
        ],
      },
      {
        title: 'Video',
        rows: [
          { key: 'aspectRatio', title: 'Aspect Ratio', description: 'Zoom crops and Stretch distorts to fill the screen, which helps with old 4:3 recordings.', options: ASPECT_RATIOS },
          { key: 'previewVideo', title: 'Preview', description: 'What the top right of Home shows for the selected talk. Video plays a short clip, Mute plays it without sound and Off shows nothing.', options: PREVIEW_VIDEO_OPTIONS },
        ],
      },
      {
        title: 'Remote Control',
        rows: [
          { key: 'remoteControl', title: 'Remote Control', description: 'Lets other devices start talks, control the player and edit the watchlist, for example from Home Assistant.', options: REMOTE_CONTROL_OPTIONS },
        ],
      },
      {
        title: 'Player Controls',
        rows: [
          { key: 'osdScale', title: 'Controls Size', description: 'Scales the text, icons and bar of the player controls on top of Text Size and Icon Size.', options: OSD_SCALE_OPTIONS },
          { key: 'osdOpacity', title: 'Controls Opacity', description: 'How strong the shaded area behind the player controls is.', options: OSD_OPACITY_OPTIONS },
          { key: 'osdMenuOpacity', title: 'Menu Opacity', description: 'Background opacity of the language, subtitle and aspect menus in the player.', options: OSD_MENU_OPACITY_OPTIONS },
          { key: 'osdHandle', title: 'Progress Handle', description: 'The shape of the handle on the progress bar.', options: OSD_HANDLES },
          { key: 'osdBarColor', title: 'Progress Color', description: 'Accent colors the played part of the bar, Neutral follows the text color of your theme.', options: OSD_BAR_COLORS },
          { key: 'osdTimeMode', title: 'Time Display', description: 'Shows the total length or the remaining time at the right end of the progress bar.', options: OSD_TIME_MODES },
          { key: 'osdButtonShape', title: 'Button Shape', description: 'Shape of the focused control button. Follow Corners uses your Corners setting.', options: OSD_BUTTON_SHAPES },
          { key: 'osdIdleButtons', title: 'Idle Buttons', description: 'How the control buttons look while they are not focused.', options: OSD_IDLE_BUTTONS },
          { key: 'osdBackButton', title: 'Back Button', description: 'Shows a back arrow at the top left of the player controls. Press Up from the buttons and OK to leave the video. The Back key works as before.', options: OSD_BACK_BUTTONS },
          { key: 'statsForNerds', title: 'Stats for Nerds', description: 'Adds a button with a bug to the player controls that shows technical details of the playback, such as the mirror, resolution, buffer and connection.', options: STATS_OPTIONS },
        ],
      },
    ],
  },
  {
    id: 'subtitles',
    label: 'Subtitles',
    iconName: 'subtitles',
    groups: [
      {
        title: 'Language',
        rows: [
          { key: 'subtitleLanguage', title: 'Subtitle Language', description: 'Preferred language for subtitles when available.', options: SUBTITLE_LANGUAGES },
        ],
      },
      {
        title: 'Style',
        preview: true,
        rows: [
          { key: 'subtitleSize', title: 'Size', description: 'Size of subtitles on the video.', options: SUBTITLE_SIZES },
          { key: 'subtitleFont', title: 'Font', description: 'The font used for subtitles. App follows the app font.', options: SUBTITLE_FONTS, variant: 'font' },
          { key: 'subtitleColor', title: 'Color', description: 'The color of the subtitle text.', options: SUBTITLE_COLORS, variant: 'swatch' },
          { key: 'subtitleBackground', title: 'Background', description: 'Auto picks a box that keeps the text readable. Themed uses the surface color of the theme. Outline draws the text without a box.', options: SUBTITLE_BACKGROUNDS },
        ],
      },
    ],
  },
  {
    id: 'about',
    label: 'Data & About',
    iconName: 'about',
    about: true,
    groups: [
      {
        title: 'Data',
        rows: [
          { key: 'clearCache', action: true, title: 'Clear Cache', description: 'Removes the cached home page and saved resume positions, then reloads the app.', button: 'Clear' },
          { key: 'clearWatchlist', action: true, title: 'Clear Watchlist', description: 'Removes every video from your watchlist.', button: 'Clear' },
        ],
      },
    ],
  },
];

TABS.forEach((tab) => {
  tab.rows = tab.groups.reduce<Row[]>((all, group) => all.concat(group.rows), []);
});

const isShown = (row: Row, values: Partial<SettingsValues>, compact: boolean) => (compact || !row.compactOnly) && (!row.showWhen || Object.keys(row.showWhen).every((key) => values[key as SettingKey] === row.showWhen![key as SettingKey]));

const buildView = (tab: Tab, values: Partial<SettingsValues>, compact: boolean) => {
  let index = 0;
  const groups = tab.groups.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => isShown(row, values, compact)).map((row) => ({ ...row, index: index++ })),
  }));
  return { groups, rows: groups.reduce<IndexedRow[]>((all, group) => all.concat(group.rows), []) };
};

const controlOf = (row: Row) => {
  if (row.action) return 'action';
  return row.options!.length <= 4 ? 'inline' : 'select';
};

const currentIndexOf = (row: Row) => {
  if (row.action) return 0;
  return Math.max(0, row.options.findIndex((option) => option.code === getSetting(row.key)));
};

const optionName = (t: ReturnType<typeof useTranslation>, option: Option) => (option.native ? option.name : t(option.name));

const fontStyle = (row: Row, option: Option) => (row.variant === 'font' && option.family ? { fontFamily: `'${option.family}', sans-serif`, fontSize: option.scale ? `${option.scale}em` : undefined } : undefined);
const swatchColor = (option: Option) => (option.code === 'accent' ? 'var(--accent)' : String(option.code));

const ButtonPreview = ({ code }: { code: string | number }) => {
  const [accent] = useSetting('accentColor');
  const [theme] = useSetting('themeMode');
  const [fill, text] = buttonColors(String(code), accent, paletteFor(theme, accent));
  return <span className="settingsView__btnPreview" style={{ background: fill, color: text }}>Aa</span>;
};

const ThemePreview = ({ code }: { code: string | number }) => {
  const [accent] = useSetting('accentColor');
  const palette = paletteFor(String(code), accent);
  return <span className="settingsView__btnPreview" style={{ background: palette.bg, color: palette.text, borderColor: palette.border }}>Aa</span>;
};

const OptionPreview = ({ row, option }: { row: Row; option: Option }) => {
  if (row.variant === 'btnstyle') return <ButtonPreview code={option.code} />;
  if (row.variant === 'theme') return <ThemePreview code={option.code} />;
  if (row.variant === 'loader') return <span className="settingsView__loaderPreview"><Spinner variant={String(option.code)} size="28px" /></span>;
  if (row.variant === 'border') return <span className="settingsView__borderPreview" style={{ borderWidth: `${option.code}px` }} />;
  if (row.variant === 'corner') return <span className="settingsView__cornerPreview" style={{ borderTopLeftRadius: `${option.radii![2]}px` }} />;
  return null;
};

const OptionContent = ({ row, option }: { row: Row; option: Option }) => {
  const t = useTranslation();
  return (
    <>
      <OptionPreview row={row} option={option} />
      <span style={fontStyle(row, option)}>{optionName(t, option)}</span>
    </>
  );
};

const SettingRow = React.memo(function SettingRow({ row, focused, optionIndex, rowRef, notice, onPick, onOpen, onHover }: { row: IndexedRow; focused: boolean; optionIndex: number; rowRef: React.RefObject<HTMLDivElement | null>; notice: string; onPick: (row: IndexedRow, index: number) => void; onOpen: (row: IndexedRow) => void; onHover: (row: IndexedRow, index: number) => void }) {
  const t = useTranslation();
  const [current] = useSetting(row.action ? 'uiLanguage' : row.key);
  const control = controlOf(row);
  const currentOption = row.options && row.options.find((option) => option.code === current);

  let controls;
  if (control === 'select') {
    controls = (
      <div className={`settingsView__select ${focused ? 'settingsView__control--focused' : ''}`} onClick={() => onOpen(row)}>
        {row.variant === 'swatch' && currentOption && (
          <span className="settingsView__dot" style={{ background: swatchColor(currentOption) }} />
        )}
        {currentOption && <OptionPreview row={row} option={currentOption} />}
        <span className="settingsView__selectName" style={currentOption ? fontStyle(row, currentOption) : undefined}>{currentOption ? optionName(t, currentOption) : ''}</span>
        <IconChevronDown className="settingsView__chevron" />
      </div>
    );
  } else if (control === 'action') {
    controls = (
      <div className={`settingsView__segment ${focused ? 'settingsView__control--focused' : ''}`} onClick={() => onPick(row, 0)}>
        {t(row.button!)}
      </div>
    );
  } else {
    controls = row.options!.map((option, index) => (
      <div
        key={String(option.code)}
        className={`settingsView__segment ${option.code === current ? 'settingsView__segment--current' : ''} ${focused && index === optionIndex ? 'settingsView__control--focused' : ''}`}
        onClick={() => onPick(row, index)}
        onMouseMove={(e) => { if (pointerMoved(e)) { onHover(row, index); e.stopPropagation(); } }}
      >
        <OptionContent row={row} option={option} />
      </div>
    ));
  }

  return (
    <div
      ref={focused ? rowRef : null}
      className={`settingsView__row ${focused ? 'settingsView__row--focused' : ''}`}
      onMouseMove={(e) => { if (pointerMoved(e)) onHover(row, -1); }}
    >
      <div className="settingsView__rowLabel">
        <span className="settingsView__rowName">{t(row.title)}</span>
        <span className="settingsView__rowDescription">{t(row.description)}{notice ? ` ${notice}` : ''}</span>
      </div>
      <div className="settingsView__rowControl">{controls}</div>
    </div>
  );
});

const columnsOf = (grid: HTMLElement | null) => {
  if (!grid) return 1;
  const columns = window.getComputedStyle(grid).getPropertyValue('grid-template-columns').split(' ').length;
  return Math.max(1, columns);
};

// Down on the last entry goes to the first and Up on the first goes to the last, in a grid within the same column
const stepVertical = (index: number, direction: 1 | -1, count: number, columns: number) => {
  if (columns === 1) return (index + direction + count) % count;
  const next = index + direction * columns;
  if (next >= 0 && next < count) return next;
  const column = index % columns;
  if (direction > 0) return column;
  const candidate = Math.floor((count - 1) / columns) * columns + column;
  return candidate < count ? candidate : candidate - columns;
};

const SettingsPicker = React.memo(function SettingsPicker({ row, index, gridRef, onPick, onHover, onClose }: { row: IndexedRow; index: number; gridRef: React.RefObject<HTMLDivElement | null>; onPick: (row: IndexedRow, index: number) => void; onHover: (index: number) => void; onClose: () => void }) {
  const t = useTranslation();
  const [current] = useSetting(row.action ? 'uiLanguage' : row.key);
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const isSwatch = row.variant === 'swatch';

  useEffect(() => {
    revealInList(selectedRef.current);
  }, [index]);

  return (
    <div className="picker">
      <div className="picker__overlay" onClick={onClose} />
      <div className="picker__panel">
        <h3 className="picker__title">{t(row.title)}</h3>
        <div className={isSwatch ? 'picker__grid' : 'picker__list'} data-wheel="scroll" ref={gridRef}>
          {row.options!.map((option, optionIndex) => {
            const selected = optionIndex === index;
            const isCurrent = option.code === current;
            if (isSwatch) {
              return (
                <div
                  key={String(option.code)}
                  ref={selected ? selectedRef : null}
                  title={optionName(t, option)}
                  className={`picker__swatch ${selected ? 'picker__swatch--selected' : ''}`}
                  onClick={() => onPick(row, optionIndex)}
                  onMouseMove={(e) => { if (pointerMoved(e)) onHover(optionIndex); }}
                >
                  <span className={`picker__swatchColor ${option.code === 'accent' ? 'picker__swatchColor--follow' : ''}`} style={{ background: swatchColor(option) }}>
                    {isCurrent && <IconCheck />}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={String(option.code)}
                ref={selected ? selectedRef : null}
                className={`picker__item ${selected ? 'picker__item--selected' : ''} ${isCurrent ? 'picker__item--current' : ''}`}
                onClick={() => onPick(row, optionIndex)}
                onMouseMove={(e) => { if (pointerMoved(e)) onHover(optionIndex); }}
              >
                <span className="picker__itemLabel">
                  <OptionPreview row={row} option={option} />
                  <span style={fontStyle(row, option)}>{optionName(t, option)}</span>
                </span>
                {isCurrent && <IconCheck />}
              </div>
            );
          })}
        </div>
        {isSwatch && <p className="picker__hint">{optionName(t, row.options![index])}</p>}
      </div>
    </div>
  );
});

const Settings = React.memo(function Settings({ onClose, onFocusSidebar, sidebarFocused }: PageProps) {
  const t = useTranslation();
  const [iconVariant] = useSetting('iconVariant');
  const [railStyle] = useSetting('railStyle');
  const [tabIndex, setTabIndex] = useState(0);
  const tabsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip && strip.querySelectorAll('.settingsView__tab')[tabIndex];
    if (!strip || !tab) return;
    const [stripBox, tabBox] = [strip.getBoundingClientRect(), tab.getBoundingClientRect()];
    strip.scrollLeft += tabBox.left + tabBox.width / 2 - (stripBox.left + stripBox.width / 2);
  }, [tabIndex]);
  const [zone, setZone] = useState('tabs');
  const [rowIndex, setRowIndex] = useState(0);
  const [optionIndex, setOptionIndex] = useState(() => currentIndexOf(TABS[0].rows![0]));
  const [modal, setModal] = useState<{ row: IndexedRow; index: number } | null>(null);
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const focusedRowRef = useRef<HTMLDivElement | null>(null);
  const modalGridRef = useRef<HTMLDivElement | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tab = TABS[tabIndex];
  const compact = useMediaQuery('(max-width: 900px)');
  const { groups, rows } = useMemo(() => buildView(tab, { railStyle }, compact), [tab, railStyle, compact]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [tabIndex]);

  const focusRef = useRef({ rowIndex, zone });
  focusRef.current = { rowIndex, zone };
  const pointerFocus = useRef(false);
  const previousFocus = useRef({ rowIndex, tabIndex: tabIndex });
  useEffect(() => {
    const moved = previousFocus.current.rowIndex !== rowIndex || previousFocus.current.tabIndex !== tabIndex;
    previousFocus.current = { rowIndex, tabIndex: tabIndex };
    if (pointerFocus.current) {
      pointerFocus.current = false;
      return;
    }
    scrollIntoView(focusedRowRef, null, moved ? 'center' : 'nearest');
  }, [rowIndex, zone, tabIndex]);

  const showNotice = (message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  };

  const runAction = (key: string) => {
    if (key === 'clearCache') {
      clearHomeCache();
      localStorage.removeItem(PLAYBACK_HISTORY_KEY);
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const name = localStorage.key(i);
        if (name && name.startsWith('playback_position_')) keysToRemove.push(name);
      }
      keysToRemove.forEach((name) => localStorage.removeItem(name));
      window.location.reload();
    } else if (key === 'clearWatchlist') {
      localStorage.removeItem('watchlist');
      window.dispatchEvent(new Event('watchlistUpdate'));
      showNotice(t('Watchlist cleared.'));
    }
  };

  const selectTab = (index: number) => {
    setTabIndex(index);
    setRowIndex(0);
    setOptionIndex(currentIndexOf(TABS[index].rows![0]));
  };

  const focusRow = (index: number) => {
    setRowIndex(index);
    setOptionIndex(currentIndexOf(rows[index]));
  };

  const pick = useCallback((row: IndexedRow, index: number) => {
    setZone('content');
    setRowIndex(row.index);
    setOptionIndex(index);
    if (row.action) runAction(row.key);
    else setSetting(row.key as SettingKey, row.options![index].code);
  }, []);

  const openModal = useCallback((row: IndexedRow) => {
    setZone('content');
    setRowIndex(row.index);
    setModal({ row, index: currentIndexOf(row) });
  }, []);

  const hover = useCallback((row: IndexedRow, index: number) => {
    if (focusRef.current.zone !== 'content' || focusRef.current.rowIndex !== row.index) pointerFocus.current = true;
    setZone('content');
    setRowIndex(row.index);
    setOptionIndex(index >= 0 ? index : currentIndexOf(row));
  }, []);

  const hoverModal = useCallback((index: number) => {
    setModal((current) => (current && current.index !== index ? { ...current, index } : current));
  }, []);

  const pickFromModal = useCallback((row: IndexedRow, index: number) => {
    setSetting(row.key as SettingKey, row.options![index].code);
    setOptionIndex(index);
    setModal(null);
  }, []);

  useWindowEvent('keydown', (e) => {
    if (sidebarFocused) return;

    const isBack = e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461;

    if (modal) {
      e.preventDefault();
      const { row, index } = modal;
      const count = row.options!.length;
      const columns = row.variant === 'swatch' ? columnsOf(modalGridRef.current) : 1;
      if (isBack || (e.key === 'ArrowLeft' && columns === 1)) setModal(null);
      else if (e.key === 'Enter') pickFromModal(row, index);
      else if (e.key === 'ArrowDown') setModal({ row, index: stepVertical(index, 1, count, columns) });
      else if (e.key === 'ArrowUp') setModal({ row, index: stepVertical(index, -1, count, columns) });
      else if (e.key === 'ArrowRight' && columns > 1 && index + 1 < count) setModal({ row, index: index + 1 });
      else if (e.key === 'ArrowLeft' && columns > 1 && index > 0) setModal({ row, index: index - 1 });
      return;
    }

    if (zone === 'tabs') {
      if (isBack) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectTab((tabIndex + 1) % TABS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectTab((tabIndex - 1 + TABS.length) % TABS.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onFocusSidebar();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setZone('content');
        focusRow(Math.min(rowIndex, rows.length - 1));
      }
      return;
    }

    if (isBack) {
      e.preventDefault();
      setZone('tabs');
      return;
    }

    const row = rows[rowIndex];
    const control = controlOf(row);
    const choices = control === 'inline';
    const count = row.options ? row.options.length : 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow((rowIndex + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow((rowIndex - 1 + rows.length) % rows.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (choices && optionIndex > 0) setOptionIndex(optionIndex - 1);
      else setZone('tabs');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (choices && optionIndex < count - 1) setOptionIndex(optionIndex + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (control === 'select') openModal(row);
      else pick(row, choices ? optionIndex : 0);
    }
  });

  return (
    <div className="settingsView">
      <nav className="settingsView__tabs" ref={tabsRef}>
        <h2 className="settingsView__tabsTitle">{t('Settings')}</h2>
        {TABS.map((item, index) => (
          <div
            key={item.id}
            className={`settingsView__tab ${index === tabIndex ? 'settingsView__tab--active' : ''} ${index === tabIndex && zone === 'tabs' && !sidebarFocused ? 'settingsView__tab--focused' : ''}`}
            onClick={() => { selectTab(index); setZone('tabs'); }}
            onMouseMove={(e) => { if (pointerMoved(e)) { if (index !== tabIndex) selectTab(index); setZone('tabs'); } }}
          >
            <span className="settingsView__tabIcon"><NavIcon name={item.iconName} filled={isFilled(iconVariant, index === tabIndex)} /></span>
            <span className="settingsView__tabLabel">{t(item.label)}</span>
          </div>
        ))}
      </nav>
      <div className="settingsView__content scrollable" data-wheel="scroll" ref={contentRef}>
        {groups.map((group) => (
          <div className="settingsView__group" key={`${tab.id}-${group.title}`}>
            <h3 className="settingsView__groupTitle">{t(group.title)}</h3>
            {group.rows.map((row) => (
              <SettingRow
                key={row.key}
                row={row}
                focused={zone === 'content' && row.index === rowIndex}
                optionIndex={zone === 'content' && row.index === rowIndex ? optionIndex : -1}
                rowRef={focusedRowRef}
                notice={row.key === 'clearWatchlist' ? notice : ''}
                onPick={pick}
                onOpen={openModal}
                onHover={hover}
              />
            ))}
            {group.preview && (
              <div className="settingsView__subtitlePreview" aria-hidden="true">
                <span>{t('This is how subtitles will look\nacross two lines of text')}</span>
              </div>
            )}
          </div>
        ))}

        {tab.about && (
          <div className="settingsView__group">
            <h3 className="settingsView__groupTitle">{t('About')}</h3>
            <p className="settingsView__about">{t('CCCBib made with ♥.')} {APP_ID} {APP_VERSION}.<br />{t('Powered by media.ccc.de. Sponsor and help if you can!')}<br />Ewige Blumenkraft! ✿</p>
          </div>
        )}
      </div>
      {tab.about && <AboutCat />}
      {modal && <SettingsPicker row={modal.row} index={modal.index} gridRef={modalGridRef} onPick={pickFromModal} onHover={hoverModal} onClose={() => setModal(null)} />}
    </div>
  );
});

export default Settings;
