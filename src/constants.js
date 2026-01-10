// Keyboard Keycodes
export const KEYCODE_WEBOS_BACK = '461'; // WebOS TV back button

// Time Constants (in milliseconds)
export const DEBOUNCE_SEARCH = 400;
export const AUTO_SAVE_INTERVAL = 300000; // 5 minutes
export const SUBTITLE_TRACK_DELAY = 100;
export const VIDEO_END_THRESHOLD = 5; // seconds

// Data Fetching
export const CONFERENCES_PER_PAGE = 6;
export const MAX_POPULAR_VIDEOS = 100;

// UI Layout
export const EVENTS_PER_ROW = 4;
export const INITIAL_ACTIVE_EVENTS = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

// Video Selection Priority Levels
export const VIDEO_PRIORITY = {
  SINGLE_WEBM: 6,
  SINGLE_MP4: 5,
  MULTI_WEBM: 4,
  MULTI_MP4: 3,
  ANY_WEBM: 2,
  ANY_MP4: 1,
};

// Storage Keys
export const STORAGE_KEYS = {
  LANGUAGE: 'language',
  SUBTITLE_LANGUAGE: 'subtitleLanguage',
  SUBTITLE_SIZE: 'subtitleSize',
  SUBTITLE_STYLE: 'subtitleStyle',
  WATCHLIST: 'watchlist',
  APOLLO_SCHEMA_VERSION: 'apollo_schema_version',
};

// API Endpoints
export const API_ENDPOINTS = {
  GRAPHQL: 'https://media.ccc.de/graphql',
  CONFERENCES: '/api/public/conferences',
  CONFERENCES_PROD: 'https://api.media.ccc.de/public/conferences',
  EVENTS_SEARCH: '/api/public/events/search',
  EVENTS_SEARCH_PROD: 'https://api.media.ccc.de/public/events/search',
  SUBTITLE_PROXY: '/subtitles',
  CDN_BASE: 'https://cdn.media.ccc.de',
  STATIC_BASE: 'https://static.media.ccc.de/media',
};

// Language options for audio/subtitle selection
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

// Derived lookup objects
export const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGES.map(l => [l.code, l.name])
);

export const LANG_CODE_MAP = {
  'eng': 'en', 'deu': 'de', 'fra': 'fr', 'spa': 'es', 'ita': 'it',
  'por': 'pt', 'rus': 'ru', 'jpn': 'ja', 'zho': 'zh', 'ara': 'ar',
  'pol': 'pl', 'nld': 'nl', 'ces': 'cs', 'fin': 'fi'
};

// Subtitle options (includes 'none')
export const SUBTITLE_LANGUAGES = [
  { code: 'none', name: 'None' },
  ...LANGUAGES.filter(l => l.code !== 'auto')
];

// Subtitle size options
export const SUBTITLE_SIZES = [
  { code: 'small', name: 'Small' },
  { code: 'medium', name: 'Medium' },
  { code: 'large', name: 'Large' },
];

// Subtitle style options
export const SUBTITLE_STYLES = [
  { code: 'green', name: 'CCC (Matrix)' },
  { code: 'white', name: 'White Text' },
  { code: 'black', name: 'Black Text' },
];

// Preview video options
export const PREVIEW_VIDEO_OPTIONS = [
  { code: 'on', name: 'On' },
  { code: 'mute', name: 'Mute' },
  { code: 'off', name: 'Off' },
];
