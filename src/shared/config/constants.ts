export const LANGUAGES = [
  { code: 'auto', name: 'Auto' },
  { code: 'deu', name: 'German' },
  { code: 'eng', name: 'English' },
  { code: 'fin', name: 'Finnish' },
  { code: 'fra', name: 'French' },
  { code: 'spa', name: 'Spanish' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'pol', name: 'Polish' },
  { code: 'nld', name: 'Dutch' },
  { code: 'ces', name: 'Czech' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'zho', name: 'Chinese' },
  { code: 'ara', name: 'Arabic' },
];

export const UI_LANGUAGES = [
  { code: 'auto', name: 'Auto' },
  { code: 'en', name: 'English', native: true },
  { code: 'de', name: 'Deutsch', native: true },
  { code: 'fr', name: 'Français', native: true },
  { code: 'es', name: 'Español', native: true },
  { code: 'it', name: 'Italiano', native: true },
  { code: 'nl', name: 'Nederlands', native: true },
  { code: 'pt', name: 'Português', native: true },
  { code: 'pl', name: 'Polski', native: true },
  { code: 'cs', name: 'Čeština', native: true },
];

export const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.name])
);

export const LANG_CODE_MAP: Record<string, string> = {
  'eng': 'en', 'deu': 'de', 'fra': 'fr', 'spa': 'es', 'ita': 'it',
  'por': 'pt', 'rus': 'ru', 'jpn': 'ja', 'zho': 'zh', 'ara': 'ar',
  'pol': 'pl', 'nld': 'nl', 'ces': 'cs', 'fin': 'fi'
};

export const SUBTITLE_LANGUAGES = [
  { code: 'none', name: 'None' },
  ...LANGUAGES.filter(l => l.code !== 'auto')
];

export const SUBTITLE_SIZES = [
  { code: 'small', name: 'Small' },
  { code: 'medium', name: 'Medium' },
  { code: 'large', name: 'Large' },
];


export const PREVIEW_VIDEO_OPTIONS = [
  { code: 'still', name: 'Picture' },
  { code: 'on', name: 'Video' },
  { code: 'mute', name: 'Mute' },
  { code: 'none', name: 'Off' },
];

export const REMOTE_CONTROL_OPTIONS = [
  { code: 'on', name: 'On' },
  { code: 'off', name: 'Off' },
];

export const THEME_MODES = [
  { code: 'black', name: 'Black' },
  { code: 'dark', name: 'Dark' },
  { code: 'light', name: 'Light' },
  { code: 'tinted', name: 'Tinted' },
  { code: 'ambient', name: 'Ambient Glow' },
  { code: 'lighttinted', name: 'Light Tinted' },
  { code: 'ember', name: 'Ember' },
  { code: 'sunset', name: 'Sunset' },
  { code: 'frost', name: 'Frost' },
  { code: 'paper', name: 'Paper' },
  { code: 'nocturne', name: 'Nocturne' },
  { code: 'abyss', name: 'Abyss' },
  { code: 'cyberpunk', name: 'Cyberpunk' },
  { code: 'terminal', name: 'Terminal' },
  { code: 'chicago', name: 'Chicago' },
];

export const ACCENT_COLORS = [
  { code: '#AAF40D', name: 'Acid Green' },
  { code: '#C6FF00', name: 'Lime' },
  { code: '#4CAF50', name: 'Green' },
  { code: '#00C853', name: 'Emerald' },
  { code: '#00C7BE', name: 'Mint' },
  { code: '#00BCD4', name: 'Cyan' },
  { code: '#03A9F4', name: 'Sky' },
  { code: '#007AFF', name: 'Blue' },
  { code: '#2962FF', name: 'Royal Blue' },
  { code: '#5856D6', name: 'Indigo' },
  { code: '#7C4DFF', name: 'Deep Purple' },
  { code: '#AF52DE', name: 'Lavender' },
  { code: '#D500F9', name: 'Magenta' },
  { code: '#FF2D55', name: 'Pink' },
  { code: '#FF007F', name: 'Rose' },
  { code: '#F44336', name: 'Red' },
  { code: '#FF6F61', name: 'Coral' },
  { code: '#FF9800', name: 'Orange' },
  { code: '#FFC107', name: 'Amber' },
  { code: '#FFEB3B', name: 'Yellow' },
  { code: '#D4AF37', name: 'Gold' },
  { code: '#9E9E9E', name: 'Silver' },
  { code: '#FFFFFF', name: 'White' },
];

export const SPINNER_STYLES = [
  { code: 'orbit', name: 'Twin Dots' },
  { code: 'rocket', name: 'Rocket' },
  { code: 'glider', name: 'Glider' },
  { code: 'ring', name: 'Simple Ring' },
  { code: 'dots', name: 'Dots' },
  { code: 'spin', name: 'Spinning Dots' },
  { code: 'bars', name: 'Equalizer' },
  { code: 'pulse', name: 'Pulse' },
  { code: 'squares', name: 'Twin Squares' },
  { code: 'ball', name: 'Rolling Ball' },
  { code: 'blocks', name: 'Step Blocks' },
  { code: 'wheel', name: 'Busy Wheel' },
  { code: 'retro', name: 'Retro Bar' },
  { code: 'boot', name: 'Boot Bar' },
  { code: 'wave', name: 'Wavy Bar' },
  { code: 'terminal', name: 'Terminal' },
  { code: 'ascii', name: 'ASCII' },
  { code: 'binary', name: 'Binary' },
  { code: 'defrag', name: 'Defrag' },
  { code: 'tape', name: 'Tape Reels' },
  { code: 'drive', name: 'Drive LEDs' },
  { code: 'chase', name: 'Chasing Dots' },
  { code: 'gears', name: 'Gears' },
  { code: 'hourglass', name: 'Hourglass' },
];

export const LOADER_STYLES = [
  { code: 'voctocat', name: 'Voctocat' },
  ...SPINNER_STYLES,
];

export const BUTTON_STYLES = [
  { code: 'accent', name: 'Accent' },
  { code: 'inverted', name: 'Inverted' },
  { code: 'white-black', name: 'White & Black' },
  { code: 'black-white', name: 'Black & White' },
  { code: 'white-accent', name: 'White & Accent' },
  { code: 'black-accent', name: 'Black & Accent' },
  { code: 'accent-white', name: 'Accent & White' },
  { code: 'accent-black', name: 'Accent & Black' },
];

export const CORNER_STYLES = [
  { code: 'square', name: 'Square', radii: [0, 0, 0, 0] },
  { code: 'classic', name: 'Classic', radii: [4, 8, 12, 16] },
  { code: 'round', name: 'Round', radii: [8, 14, 22, 30] },
];

const borderOption = (width: number) => ({
  code: width,
  name: width === 5 ? 'Normal (5px)' : `${width}px`,
});

export const BORDER_WIDTHS = [1, 2, 3, 4, 5, 6, 8].map(borderOption);

export const SCROLLBAR_SIZES = [
  { code: 'normal', name: 'Normal' },
  { code: 'large', name: 'Large' },
  { code: 'hidden', name: 'Hidden' },
];

export const RAIL_STYLES = [
  { code: 'transparent', name: 'Plain' },
  { code: 'panel', name: 'Panel' },
  { code: 'glass', name: 'Glass' },
];

export const GLASS_SHEEN = [
  { code: 'gloss', name: 'Shiny' },
  { code: 'flat', name: 'Flat' },
];

export const GLASS_TRANSPARENCY = [
  { code: 'low', name: 'Low' },
  { code: 'medium', name: 'Medium' },
  { code: 'high', name: 'High' },
];

export const MENU_COLORS = [
  { code: 'grey', name: 'Grey' },
  { code: 'white', name: 'White' },
  { code: 'black', name: 'Black' },
  { code: 'accent', name: 'Accent' },
];

export const NAV_INDICATORS = [
  { code: 'off', name: 'Off' },
  { code: 'line', name: 'Line' },
  { code: 'border', name: 'Border' },
  { code: 'contrast', name: 'Contrast' },
];

export const ICON_VARIANTS = [
  { code: 'dynamic', name: 'Dynamic' },
  { code: 'outlined', name: 'Outlined' },
  { code: 'filled', name: 'Filled' },
];

export const MENU_POSITIONS = [
  { code: 'top', name: 'Top' },
  { code: 'bottom', name: 'Bottom' },
];

export const LOGO_BUTTONS = [
  { code: 'off', name: 'Off' },
  { code: 'settings', name: 'Settings' },
  { code: 'home', name: 'Home' },
];

const scaleOption = (scale: number) => ({
  code: scale,
  name: scale === 1 ? 'Normal (100%)' : `${Math.round(scale * 100)}%`,
});

export const TEXT_SCALE_BASE = 1.2;
export const ICON_SCALE_BASE = 1.1;

export const SCALE_OPTIONS = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5].map(scaleOption);

export const TEXT_SCALE_OPTIONS = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75].map(scaleOption);

export const OSD_SCALE_OPTIONS = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2].map(scaleOption);

const percentOption = (value: number) => ({ code: value, name: `${Math.round(value * 100)}%` });

export const OSD_OPACITY_OPTIONS = [0.4, 0.6, 0.8, 1].map(percentOption);

export const OSD_MENU_OPACITY_OPTIONS = [0.7, 0.8, 0.9, 1].map(percentOption);

export const OSD_HANDLES = [
  { code: 'block', name: 'Block' },
  { code: 'round', name: 'Round' },
  { code: 'pill', name: 'Pill' },
];

export const OSD_BAR_COLORS = [
  { code: 'accent', name: 'Accent' },
  { code: 'neutral', name: 'Neutral' },
];

export const OSD_TIME_MODES = [
  { code: 'total', name: 'Total Duration' },
  { code: 'remaining', name: 'Remaining Time' },
];

export const OSD_BUTTON_SHAPES = [
  { code: 'rounded', name: 'Follow Corners' },
  { code: 'circle', name: 'Circle' },
];

export const OSD_BACK_BUTTONS = [
  { code: 'off', name: 'Off' },
  { code: 'on', name: 'On' },
];

export const STATS_OPTIONS = [
  { code: 'off', name: 'Off' },
  { code: 'on', name: 'On' },
];

export const OSD_IDLE_BUTTONS = [
  { code: 'icon', name: 'Icon Only' },
  { code: 'outline', name: 'Outline' },
  { code: 'soft', name: 'Soft' },
];

const SUBTITLE_BASE_COLORS = [
  { code: '#FFFFFF', name: 'White' },
  { code: '#D3D3D3', name: 'Light Grey' },
  { code: '#FFEB3B', name: 'Yellow' },
  { code: '#00E5FF', name: 'Cyan' },
  { code: '#AAF40D', name: 'Acid Green' },
  { code: '#000000', name: 'Black' },
  { code: 'accent', name: 'Follow Accent' },
];

export const SUBTITLE_COLORS = [
  ...SUBTITLE_BASE_COLORS,
  ...ACCENT_COLORS.filter((color) => !SUBTITLE_BASE_COLORS.some((base) => base.code === color.code)),
];

export const SUBTITLE_BACKGROUNDS = [
  { code: 'auto', name: 'Auto' },
  { code: 'dark', name: 'Dark' },
  { code: 'light', name: 'Light' },
  { code: 'theme', name: 'Themed' },
  { code: 'outline', name: 'Outline' },
];

export const SYSTEM_FONT_STACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const UI_FONTS = [
  { code: 'default', name: 'System', family: null },
  { code: 'console', name: 'Inconsolata', family: 'Inconsolata', scale: 1.15 },
  { code: 'plex-mono', name: 'IBM Plex Mono', family: 'IBM Plex Mono' },
  { code: 'fira-code', name: 'Fira Code', family: 'Fira Code' },
  { code: 'space-mono', name: 'Space Mono', family: 'Space Mono' },
  { code: 'silkscreen', name: 'Silkscreen', family: 'Silkscreen', scale: 0.85 },
  { code: 'vt323', name: 'VT323', family: 'VT323', scale: 1.15 },
  { code: 'jersey10', name: 'Jersey 10', family: 'Jersey 10', scale: 1.1 },
  { code: 'tiny5', name: 'Tiny5', family: 'Tiny5' },
  { code: 'geist-pixel', name: 'Geist Pixel', family: 'Geist Pixel' },
  { code: 'inter', name: 'Inter', family: 'Inter' },
  { code: 'poppins', name: 'Poppins', family: 'Poppins' },
  { code: 'open-sans', name: 'Open Sans', family: 'Open Sans' },
  { code: 'space-grotesk', name: 'Space Grotesk', family: 'Space Grotesk' },
  { code: 'lexend', name: 'Lexend', family: 'Lexend' },
  { code: 'atkinson', name: 'Atkinson Hyperlegible Next', family: 'Atkinson Hyperlegible Next', scale: 1.1 },
  { code: 'andika', name: 'Andika', family: 'Andika' },
  { code: 'comic-neue', name: 'Comic Neue', family: 'Comic Neue', scale: 1.1 },
  { code: 'opendyslexic', name: 'OpenDyslexic', family: 'OpenDyslexic', scale: 0.85 },
  { code: 'print', name: 'Merriweather', family: 'Merriweather' },
  { code: 'typewriter', name: 'Courier Prime', family: 'Courier Prime' },
];

export const SUBTITLE_FONTS = [{ code: 'app', name: 'App' }, ...UI_FONTS];

export const ASPECT_RATIOS = [
  { code: 'auto', name: 'Auto', objectFit: 'contain' as const },
  { code: 'zoom', name: 'Zoom', objectFit: 'cover' as const },
  { code: 'stretch', name: 'Stretch', objectFit: 'fill' as const },
];

export const SETTING_DEFAULTS = {
  uiLanguage: 'auto',
  language: 'deu',
  subtitleLanguage: 'none',
  subtitleSize: 'medium',
  subtitleFont: 'default',
  subtitleColor: '#AAF40D',
  subtitleBackground: 'auto',
  previewVideo: 'still',
  remoteControl: 'off',
  themeMode: 'black',
  accentColor: '#AAF40D',
  uiFont: 'default',
  loaderStyle: 'voctocat',
  railStyle: 'transparent',
  logoButton: 'off',
  menuPosition: 'top',
  iconVariant: 'outlined',
  glassSheen: 'gloss',
  glassTransparency: 'low',
  menuIconColor: 'grey',
  menuActiveColor: 'accent',
  navIndicator: 'line',
  buttonStyle: 'accent',
  cornerStyle: 'classic',
  borderWidth: 5,
  scrollbarSize: 'normal',
  spinnerStyle: 'orbit',
  textScale: 1,
  tileScale: 1,
  iconScale: 1,
  menuScale: 1,
  aspectRatio: 'auto',
  osdScale: 1,
  osdOpacity: 1,
  osdMenuOpacity: 1,
  osdHandle: 'block',
  osdBarColor: 'accent',
  osdTimeMode: 'total',
  osdButtonShape: 'rounded',
  osdIdleButtons: 'icon',
  osdBackButton: 'off',
  statsForNerds: 'off',
};
