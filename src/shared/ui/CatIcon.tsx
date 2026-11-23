import { useId } from 'react';
import { useSetting } from '@/shared/config';

const CAT_DISC = 'M 13.228772,0.30234532 C 6.0691486,0.30234532 0.26458395,6.10691 0.26458395,13.267323 A 12.964978,12.964978 0 0 0 1.1118578,17.862438 C 1.3017821,17.365207 1.5196676,16.879844 1.7942668,16.424026 1.9340722,16.191896 2.0878581,15.966888 2.1904701,15.717085 2.2933458,15.46649 2.3408269,15.183714 2.2622191,14.924942 2.2173761,14.77775 2.1329652,14.644803 2.041696,14.521352 1.9501631,14.397374 1.8499251,14.280254 1.7665694,14.150736 1.5544871,13.821798 1.4571509,13.41689 1.5122817,13.029655 c 0.055395,-0.387763 0.2643115,-0.754423 0.5792695,-0.98708 0.280666,-0.207333 0.6351916,-0.300714 0.9854966,-0.287524 a 1.7568007,1.7568007 0 0 1 0.3455569,0.04748 c 0.4526531,0.109998 0.852022,0.393037 1.1482512,0.751784 0.3671872,0.445795 0.5829625,1.009765 0.6357193,1.584813 0.053284,0.575049 -0.052757,1.160649 -0.2748629,1.693493 -0.3983136,0.954898 -1.1506253,1.725674 -1.5647659,2.673714 -0.3381711,0.774469 -0.4352436,1.638098 -0.3890813,2.482206 0.00633,0.0786 0.016883,0.156688 0.023741,0.235295 a 12.964978,12.964978 0 0 0 3.6193788,3.180442 17.628677,17.628677 0 0 1 -0.1287265,-2.11027 c 0.00184,-0.561333 0.030335,-1.121082 0.084411,-1.675029 C 6.2355962,20.384214 5.9259139,20.109878 5.7061819,19.760892 5.3152541,19.139153 5.2413947,18.352286 5.4023029,17.635586 c 0.1609082,-0.716702 0.5407569,-1.369567 0.997103,-1.944879 0.7528393,-0.948304 1.7362257,-1.715651 2.83515,-2.223699 -0.031654,-0.04352 -0.063308,-0.0881 -0.089689,-0.125561 C 8.7402212,12.686472 8.5012335,11.931786 8.4432007,11.163911 8.3841165,10.387331 8.5065088,9.609695 8.557947,8.8328528 8.5948734,8.2910402 8.5969902,7.7487012 8.6286443,7.2066251 8.6655707,6.5796108 8.7420714,5.9518051 8.9180158,5.3490588 8.981853,5.1306459 9.0599316,4.9124965 9.1839095,4.7212532 A 1.4006925,1.4006925 0 0 1 9.7782155,4.2058195 C 10.05176,4.0976681 10.289429,4.0744551 10.553741,4.1187705 c 0.22105,0.047481 0.425482,0.1569516 0.604593,0.295438 0.179372,0.1376952 0.334214,0.3041429 0.480614,0.4766575 a 7.2975815,7.2975815 0 0 1 1.037725,1.6159402 3.5711064,3.5711064 0 0 1 1.092065,0 7.2865025,7.2865025 0 0 1 1.038254,-1.6162038 C 14.953129,4.718088 15.108496,4.5516403 15.287607,4.4136814 15.46698,4.2754586 15.671148,4.1657246 15.892463,4.1187709 a 1.2680092,1.2680092 0 0 1 0.780009,0.087049 1.4022752,1.4022752 0 0 1 0.594305,0.5170164 c 0.123979,0.1907158 0.202058,0.40781 0.265894,0.6264868 0.175681,0.6027462 0.252178,1.2305519 0.289107,1.8570386 0.03166,0.5423399 0.03429,1.0862616 0.07122,1.6275471 0.05144,0.7771065 0.174888,1.5536852 0.116065,2.3300022 a 4.8549426,4.8549426 0 0 1 -0.703775,2.178064 c -0.03166,0.05012 -0.07017,0.09575 -0.102876,0.145081 0.246374,0.2775 0.597997,0.513324 0.89792,0.614089 a 1.9556938,1.9556938 0 0 0 1.048277,0.04273 1.6504958,1.6504958 0 0 0 0.533898,-0.226327 1.2529736,1.2529736 0 0 0 0.396995,-0.417834 c 0.118703,-0.208389 0.166184,-0.448433 0.192563,-0.687157 0.06726,-0.608813 0,-1.223957 -0.05012,-1.834353 -0.03429,-0.396203 -0.06198,-0.799265 0.0269,-1.1870281 0.06015,-0.2624642 0.177792,-0.5191263 0.374575,-0.7024558 A 1.1057821,1.1057821 0 0 1 21.088206,8.835488 1.3120611,1.3120611 0 0 1 21.618412,8.806466 c 0.379849,0.055401 0.735429,0.2727525 0.947512,0.5921948 0.120548,0.1814838 0.193881,0.3911921 0.237932,0.6048572 0.04378,0.213665 0.05988,0.431286 0.07174,0.648908 0.04115,0.76049 0.03957,1.522034 0.01847,2.283578 -0.01767,0.664735 -0.05539,1.347936 -0.321289,1.957277 -0.341864,0.782117 -1.03034,1.365872 -1.773946,1.785289 a 7.0517349,7.0517349 0 0 1 -1.586925,0.648907 c 0.481933,1.538388 0.732792,3.240586 0.732792,4.967051 a 17.59887,17.59887 0 0 1 -0.134527,2.12557 12.964451,12.964451 0 0 0 6.383571,-11.152254 C 26.192959,6.1071738 20.388395,0.30287299 13.228772,0.30287299 Z';
const CAT_PLAY = 'M 9.6027982,16.283956 v 1.482994 a 1.8799879,1.8799879 0 0 1 1.0833608,0.362438 1.7378083,1.7378083 0 0 1 0.556057,0.680563 c 0.12134,0.270378 0.166183,0.575841 0.116064,0.867849 a 1.4930169,1.4930169 0 0 1 -0.33184,0.707996 1.6468029,1.6468029 0 0 1 -0.635718,0.457929 1.7383359,1.7383359 0 0 1 -0.7879238,0.122131 V 24.69708 L 17.364903,20.488408 9.6025338,16.283693 Z';

const Cat = () => (
  <svg viewBox="0 0 26.458318 26.458333" aria-hidden="true">
    <path className="catIcon__disc" d={CAT_DISC} />
    <path className="catIcon__play" d={CAT_PLAY} />
  </svg>
);

const APPLE_OUTLINE = 'M50 30C58 22 80 24 86 44C92 64 80 92 62 94C56 95 53 92 50 92C47 92 44 95 38 94C20 92 8 64 14 44C20 24 42 22 50 30Z';
const APPLE_PLAY = 'M36 44C36 40 40 38 43.5 40L74 58C77.5 60 77.5 64 74 66L43.5 84C40 86 36 84 36 80Z';
const APPLE_TILT = 'translate(0 -1.5) rotate(8 50 62)';
const APPLE_TILTED_BODY = 'M54.5 28.8C63.5 22.0 85.0 27.0 88.2 47.7C91.3 68.3 75.5 94.4 57.4 93.9C51.3 94.0 48.8 90.6 45.8 90.2C42.9 89.8 39.5 92.3 33.7 90.5C16.1 86.0 8.1 56.6 16.9 37.7C25.6 18.7 47.6 19.8 54.5 28.8Z' + APPLE_PLAY;
const APPLE_K_TRANSFORM = 'translate(50 57) rotate(8) scale(1.14) translate(-50 -59)';
const APPLE_K = [
  'M34.5 41H44V77.5H34.5Z',
  'M26 37H52V40.5C47 40.5 44 41.5 44 45H34.5C34.5 41.5 31.5 40.5 26 40.5Z',
  'M26 81H52V77.5C47 77.5 44 76.5 44 73H34.5C34.5 76.5 31.5 77.5 26 77.5Z',
  'M44 60.5L60 38H63.7L44 66.5Z',
  'M44 59.5L51.5 54.5L70 77.5H61.5Z',
  'M55 81H73.5V77.5H71C68.5 77.5 67.5 76.5 66.5 74.5H62.5C61.5 76.5 60 77.5 55 77.5Z',
  'M59.1 39.5a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0-7.8 0Z',
];
const APPLE_STEM = 'M48 30C48 22 50 16 55 11L59 14C55 18 54 23 54 30Z';
const APPLE_LEAF = 'M56 20C60 8 74 5 84 10C82 22 68 28 56 20Z';

const APPLE_THEMES = ['kallisti', 'eris'];

const AQUA_INK = '#131313';
const AQUA_TONES = [
  ['deepLeft', '#2a63ff', '#0618b8'],
  ['catLeft', '#7aa2ff', '#2f66f0'],
  ['deepRight', '#e4eaff', '#a9b8f6'],
  ['catRight', '#ffffff', '#e6ecff'],
];
const AQUA_TILE = 'M8.9 0.9H17.56C23.16 0.9 25.56 3.3 25.56 8.9V17.56C25.56 23.16 23.16 25.56 17.56 25.56H8.9C3.3 25.56 0.9 23.16 0.9 17.56V8.9C0.9 3.3 3.3 0.9 8.9 0.9Z';
const AQUA_SPLIT = 'M14.4 -1C11 5 11 9.5 13.2 13.4C15.4 17.3 15.6 21.5 12.2 27.5';
const AQUA_SPLIT_LEFT = `M0 -1H14.4${AQUA_SPLIT.slice(AQUA_SPLIT.indexOf('C'))}H0Z`;
const AQUA_SPLIT_RIGHT = `M26.458 -1H14.4${AQUA_SPLIT.slice(AQUA_SPLIT.indexOf('C'))}H26.458Z`;
const AQUA_CAT_SCALE = 1.08;
const AQUA_CAT = `translate(13.229 14) scale(${AQUA_CAT_SCALE}) translate(-13.229 -13.229)`;
const AQUA_LINE = 1.15;
const AQUA_CIRCLE = { cx: 13.2288, cy: 13.2673, r: 12.965 };

const GLYPH_ROWS = [
  '..........LL..',
  '.......#.LLLL.',
  '.......#LLLL..',
  '...###..###...',
  '..##########..',
  '.###..##..###.',
  '.###..#..####.',
  '.###....#####.',
  '.###...######.',
  '.###....#####.',
  '..##..#..###..',
  '..##..##..##..',
  '...########...',
  '...###..###...',
];

const LOGO_ROWS = [
  '.........LLL....',
  '........#.LLLL..',
  '........#LLLL...',
  '........#.LL....',
  '...####..####...',
  '..#####..#####..',
  '.####.#########.',
  '.####..########.',
  '.####...#######.',
  '.####.....#####.',
  '.####......####.',
  '.####.....#####.',
  '..###...######..',
  '..###..#######..',
  '...##.#######...',
  '....###..###....',
];

const pixelPath = (rows: string[], mark: string) =>
  rows.flatMap((row, y) => Array.from(row.matchAll(new RegExp(`${mark}+`, 'g')), (run) => `M${run.index ?? 0} ${y}h${run[0].length}v1h-${run[0].length}z`)).join('');

interface Classes { svg: string; body: string; leaf: string }

const MENU: Classes = { svg: 'catIcon--apple', body: 'catIcon__disc', leaf: 'catIcon__play' };
const MENU_PIXEL: Classes = { ...MENU, svg: 'catIcon--apple catIcon--pixel' };
const GLYPH: Classes = { svg: 'appleGlyph', body: 'appleGlyph__body', leaf: 'appleGlyph__leaf' };

const PixelApple = ({ rows, size, classes }: { rows: string[]; size: number; classes: Classes }) => (
  <svg className={classes.svg} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
    <path className={classes.body} d={pixelPath(rows, '#')} />
    <path className={classes.leaf} d={pixelPath(rows, 'L')} />
  </svg>
);

const AppleK = () => {
  const mask = `appleK${useId().replace(/:/g, '')}`;
  return (
    <svg className={GLYPH.svg} viewBox="5 3 90 92" aria-hidden="true">
      <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect width="100" height="100" fill="white" />
        <g fill="black" transform={APPLE_K_TRANSFORM}>{APPLE_K.map((d) => <path key={d} d={d} />)}</g>
      </mask>
      <path className={GLYPH.body} mask={`url(#${mask})`} d={APPLE_OUTLINE} />
      <path className={GLYPH.body} d={APPLE_STEM} />
      <path className={GLYPH.leaf} d={APPLE_LEAF} />
    </svg>
  );
};

const ApplePlay = () => (
  <svg className={MENU.svg} viewBox="5 3 90 92" aria-hidden="true">
    <path className={MENU.body} fillRule="evenodd" d={APPLE_TILTED_BODY} />
    <g transform={APPLE_TILT}>
      <path className={MENU.body} d={APPLE_STEM} />
      <path className={MENU.leaf} d={APPLE_LEAF} />
    </g>
  </svg>
);

const AquaCat = () => {
  const id = `aquaCat${useId().replace(/:/g, '')}`;
  const fill = (key: string) => `url(#${id}${key})`;
  return (
    <svg className="catIcon--aqua" viewBox="0 0 26.458318 26.458333" aria-hidden="true">
      <defs>
        {AQUA_TONES.map(([key, top, bottom]) => (
          <linearGradient key={key} id={`${id}${key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        ))}
        <linearGradient id={`${id}gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
        <clipPath id={`${id}left`}><path d={AQUA_SPLIT_LEFT} /></clipPath>
        <clipPath id={`${id}right`}><path d={AQUA_SPLIT_RIGHT} /></clipPath>
        <clipPath id={`${id}tile`}><path d={AQUA_TILE} /></clipPath>
        <clipPath id={`${id}inner`}><circle {...AQUA_CIRCLE} r="12" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}tile)`} strokeLinejoin="round">
        {[['Left', 'left'], ['Right', 'right']].map(([tone, side]) => (
          <g key={side} clipPath={`url(#${id}${side})`}>
            <path d={AQUA_TILE} fill={fill(`deep${tone}`)} />
            <g transform={AQUA_CAT}>
              <circle {...AQUA_CIRCLE} fill={fill(`cat${tone}`)} />
              <path d={CAT_DISC} fill={fill(`deep${tone}`)} />
            </g>
          </g>
        ))}
        <path d="M0 0H26.458V9.4Q13.229 14.2 0 9.4Z" fill={fill('gloss')} />
        <path d={AQUA_SPLIT} fill="none" stroke={AQUA_INK} strokeWidth="1.3" />
        <g transform={AQUA_CAT}>
          <path d={CAT_DISC} fill="none" stroke={AQUA_INK} strokeWidth={AQUA_LINE / AQUA_CAT_SCALE} clipPath={`url(#${id}inner)`} />
        </g>
        <path className="catIcon__play" d={CAT_PLAY} transform="translate(0.017 -0.589)" stroke={AQUA_INK} strokeWidth="0.9" />
      </g>
      <path d={AQUA_TILE} fill="none" stroke={AQUA_INK} strokeWidth={AQUA_LINE} strokeLinejoin="round" />
    </svg>
  );
};

export const AppleGlyph = ({ pixelated }: { pixelated: boolean }) =>
  pixelated ? <PixelApple rows={GLYPH_ROWS} size={14} classes={GLYPH} /> : <AppleK />;

export const CatIcon = () => {
  const [themeMode] = useSetting('themeMode');
  const [iconVariant] = useSetting('iconVariant');
  if (themeMode === 'aqua') return <AquaCat />;
  if (!APPLE_THEMES.includes(themeMode)) return <Cat />;
  return iconVariant === 'pixelated' ? <PixelApple rows={LOGO_ROWS} size={16} classes={MENU_PIXEL} /> : <ApplePlay />;
};
