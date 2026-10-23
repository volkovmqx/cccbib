import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SETTING_DEFAULTS } from '@/shared/config/constants';
import { computeAppearance } from '@/shared/config/appearance';

const css = ['src/app/styles/styles.css', 'src/shared/branding/canvases.css']
  .map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1].split(',').map((selector) => selector.trim()),
  body: match[2],
}));

const declarations = (selector: string) => rules
  .filter((rule) => rule.selectors.includes(selector))
  .map((rule) => rule.body)
  .join('\n');

const property = (selector: string, name: string) => {
  const match = new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`).exec(declarations(selector));
  return match ? match[1].trim() : '';
};

test('every theme with a canvas paints it behind the page and lists one fixed attachment per layer', () => {
  const themes = ['ambient', 'ember', 'sunset', 'frost', 'paper', 'nocturne', 'abyss', 'cyberpunk', 'terminal', 'chicago'];
  expect(property("html[data-canvas='glow']::before", 'background')).toBe('var(--canvas)');
  expect(property("html[data-canvas='glow']::before", 'position')).toBe('fixed');
  expect(property("html[data-canvas='glow']", '--page-bg')).toBe('transparent');
  for (const theme of themes) {
    const layers = property(`html[data-theme='${theme}']`, '--canvas').match(/(?:radial|linear)-gradient\(/g) || [];
    if (!['ambient', 'frost', 'paper'].includes(theme)) expect(property(`html[data-theme='${theme}']`, '--canvas'), theme).toContain('var(--accent-rgb)');
    const attachments = property(`html[data-theme='${theme}']`, '--canvas-fixed').split(',').map((value) => value.trim());
    expect(layers.length, theme).toBeGreaterThan(0);
    expect(attachments, theme).toEqual(Array(layers.length).fill('fixed'));
  }
  expect(property("html[data-canvas='glow'] .previewOverlay", 'background-attachment')).toBe('var(--canvas-fixed), scroll');
  expect(css).not.toMatch(/data-theme='ambient'\]\s+\./);
});

test('the Chicago theme draws Windows 95 style raised panels and buttons', () => {
  expect(property("html[data-theme='chicago']", '--bevel')).toContain('#ffffff');
  expect(property("html[data-theme='chicago'] .picker__panel", 'box-shadow')).toBe('var(--bevel)');
  expect(property("html[data-theme='chicago'] .settingsView__select", 'border-radius')).toBe('0');
});

test('screens up to 900px wide get a bottom tab bar, fluid text and a stacked Settings page', () => {
  const small = css.slice(css.indexOf('@media (max-width: 900px)'));
  expect(small).toContain('font-size: calc((1vw + 2.6px) * var(--text-scale, 1));');
  expect(small).toMatch(/--sidebar-width:\s*0px/);
  expect(small).toContain('--screen-height: 100dvh;');
  expect(small).toMatch(/\.settingsView \.settingsView__cat\s*\{[^}]*left:\s*50%;[^}]*translate\(-50%, -50%\)/);
  expect(small).toMatch(/\.itemTitle,[^{]*\{\s*font-size:\s*calc\(\(1vw \+ 9\.5px\)/);
  expect(small).toMatch(/\.searchInput input\s*\{[^}]*padding:\s*0 16px;[^}]*font-size:\s*calc\(\(0\.9vw \+ 11px\)/);
  expect(small).toMatch(/\.sidebar__main\s*\{[^}]*display:\s*contents/);
  expect(small.replace('--screen-height: 100vh;', '')).not.toContain('100vh');
  expect(small).toMatch(/\.appShell__nav\s*\{[^}]*top:\s*0;[^}]*width:\s*100%/);
  expect(small).toMatch(/\.settingsView\s*\{[^}]*flex-direction:\s*column/);
  expect(css.slice(0, css.indexOf('@media (max-width: 900px)'))).not.toContain('--nav-height');
});

test('tiles are one big column on a phone and two on a tablet, and a phone drops the preview that taps cannot choose', () => {
  const small = css.slice(css.indexOf('@media (max-width: 900px)'));
  const phone = css.slice(css.indexOf('@media (max-width: 599px)'));
  expect(phone).toContain('--slide-width: calc(100vw - 2 * var(--gutter) - 12px);');
  expect(small).toMatch(/\.playerUI__group--center\s*\{[^}]*position:\s*static;[^}]*space-between;[^}]*order:\s*-1;[^}]*padding:\s*0 calc\(\(100% - min\(64vw, 300px\)\) \/ 2\)/);
  expect(small).toMatch(/\.playerUI__buttons\s*\{\s*flex-wrap:\s*wrap/);
  expect(small).toMatch(/\.preview,\s*\.previewOverlay,\s*\.title\s*\{\s*display:\s*none/);
  const tablet = css.slice(css.indexOf('@media (min-width: 600px) and (max-width: 900px)'), css.indexOf('@media (max-width: 599px)'));
  expect(tablet).toContain('--slide-width: calc((100vw - 3 * var(--gutter)) / 2.08);');
  expect(tablet).toContain('-webkit-line-clamp: 3;');
});

test('a phone held sideways gets a smaller title over the video', () => {
  const sideways = css.slice(css.indexOf('@media (max-width: 900px) and (max-height: 500px)'));
  expect(sideways).toMatch(/\.playerUI__title\s*\{\s*font-size:\s*calc\(2\.6vw/);
});

test('small screens draw lighter borders, a sideways phone shows three tiles in a slimmer bar and a landscape tablet shrinks its tiles', () => {
  const small = css.slice(css.indexOf('@media (max-width: 900px)'));
  expect(small).toContain('--border-width: var(--border-width-compact, 3px) !important;');
  const sideways = css.slice(css.indexOf('@media (max-width: 900px) and (max-height: 500px)'), css.indexOf('@media (min-width: 901px)'));
  expect(sideways).toContain('--slide-width: calc((100vw - 4 * var(--gutter)) / 3.1);');
  expect(sideways).toContain('--nav-height: calc(48px + env(safe-area-inset-top, 0px));');
  const landscape = css.slice(css.indexOf('@media (min-width: 901px) and (max-width: 1279px)'));
  expect(landscape).toContain('--slide-width: calc((100vw - var(--content-left)) / 2.5);');
});

test('tiles are never dimmed on small screens and touch screens drop the selection marks that only make sense with a pointer', () => {
  const all = css.slice(css.indexOf('@media (max-width: 900px), (max-width: 1279px) and (hover: none)'));
  expect(all).toMatch(/\.embla__slide__img,\s*\.conferenceView__gridItem__img\s*\{\s*opacity:\s*1;/);
  expect(all).toMatch(/\.sidebarItem--highlighted,\s*\.sidebarItem--highlighted:hover\s*\{[^}]*background-color:\s*transparent;[^}]*color:\s*var\(--menu-icon\)/);
  expect(all).toMatch(/\.sidebarItem--highlighted \.sidebarItem__icon\s*\{\s*color:\s*var\(--menu-active\)/);
  const touch = css.slice(css.indexOf('@media (max-width: 1279px) and (hover: none)'));
  expect(touch).toMatch(/\.embla__slide__media:active,\s*\.conferenceView__gridItem__media:active\s*\{\s*opacity:\s*0\.85/);
  expect(touch).toMatch(/\.sidebarItem--highlighted \.sidebarItem__icon\s*\{\s*color:\s*var\(--menu-icon\)/);
  expect(touch).toMatch(/\.active \.embla__slide__img\s*\{[^}]*box-shadow:\s*none/);
  expect(touch).toMatch(/\.listItem--selected\s*\{[^}]*border-color:\s*transparent/);
});

test('a menu at the bottom moves the bar, the page offsets and the Settings tabs down', () => {
  const small = css.slice(css.indexOf('@media (max-width: 900px)'));
  expect(small).toMatch(/html\[data-menu-position='bottom'\] \.appShell__nav\s*\{\s*top:\s*auto;\s*bottom:\s*0/);
  expect(small).toMatch(/html\[data-menu-position='bottom'\]\s*\{[^}]*--bar-top:\s*0px;[^}]*--bar-bottom:\s*var\(--nav-height\)/);
  expect(small).toMatch(/html\[data-menu-position='bottom'\] \.settingsView\s*\{\s*flex-direction:\s*column-reverse/);
  expect(small).toMatch(/\.appShell__main\s*\{[^}]*padding-top:\s*var\(--bar-top\);[^}]*padding-bottom:\s*var\(--bar-bottom\)/);
});

test('on small screens the Settings tabs share the look of the menu bar: no fill, a mark under the active tab and a press colour', () => {
  const small = css.slice(css.indexOf('@media (max-width: 900px)'));
  expect(small).toMatch(/\.settingsView__tab--active,\s*\.settingsView__tab--focused\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--menu-active\)/);
  expect(small).toMatch(/\.settingsView__tab--active::before\s*\{[^}]*bottom:\s*0;[^}]*background:\s*var\(--accent-stroke\)/);
  expect(small).toMatch(/\.settingsView__tab:active\s*\{\s*color:\s*var\(--menu-active\)/);
  expect(small).toMatch(/\.sidebarItem:active \.sidebarItem__icon\s*\{[^}]*transform:\s*scale\(0\.9\)/);
});

test('list rows and grid tiles only animate the properties their states change', () => {
  expect(property('.listItem', 'transition')).toBe('background-color var(--transition-fast), border-color var(--transition-fast)');
  expect(property('.conferenceView__gridItem', 'transition')).toBe('border-color var(--transition-fast), box-shadow var(--transition-fast)');
  expect(css).not.toMatch(/transition:\s*all\b/);
});

test('the TV switches off the fades of tiles and rows, other screens keep them', () => {
  expect(property('html[data-webos] .embla__slide__img', 'transition')).toBe('none');
  expect(property('html[data-webos] .listItem', 'transition')).toBe('none');
  expect(property('html[data-webos] .conferenceView__gridItem', 'transition')).toBe('none');
  expect(property('.embla__slide__img', 'transition')).toContain('box-shadow');
});

test('a conference name that opens its page gets a pointer and an arrow in the accent colour, without an underline', () => {
  expect(property('.carouselTitle--link', 'cursor')).toBe('pointer');
  expect(property('.carouselTitle--link::after', 'content')).toBe("' \\203A'");
  expect(property('.carouselTitle--link::after', 'color')).toBe('var(--accent-text)');
  expect(css).not.toContain('.carouselTitle--link:hover');
});

test('marked text uses the accent and its readable contrast colour instead of the browser colours', () => {
  expect(property('::selection', 'background')).toBe('var(--accent)');
  expect(property('::selection', 'color')).toBe('var(--accent-contrast)');
});

test('every custom property the stylesheet reads is defined by it or by the appearance settings', () => {
  const defined = new Set([
    ...[...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
    ...Object.keys(computeAppearance(SETTING_DEFAULTS).vars),
  ]);
  const used = [...new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]))];
  expect(used.filter((name) => !defined.has(name))).toEqual([]);
});

test('tiles on every screen draw their outline with the shared border width', () => {
  const tiles = ['.listItem', '.embla__slide__img', '.active .embla__slide__img', '.conferenceView__gridItem', '.settingsView__segment', '.settingsView__select', '.picker__swatch'];
  for (const selector of tiles) expect(property(selector, 'border'), selector).toContain('var(--border-width)');
  expect(css).not.toContain('--list-item-border');
  expect(property(':root', '--border-width')).toBe('5px');
});

test('popups use the popup surface, which the Black theme turns pure black', () => {
  for (const selector of ['.picker__panel', '.player-wrapper .picker__panel', '.remote-notice', '.player-toast']) {
    const background = property(selector, 'background');
    expect(background, selector).toMatch(/var\(--popup-(bg|rgb)\)/);
    expect(background, selector).not.toMatch(/var\(--surface(-rgb)?\)/);
  }
  expect(property(':root', '--popup-bg')).toBe('var(--surface)');
  expect(property("html[data-theme='black']", '--popup-bg')).toBe('var(--bg)');
  expect(property("html[data-theme='black']", '--popup-rgb')).toBe('var(--bg-rgb)');
});

test('scrollbars are themed everywhere instead of only inside marked containers', () => {
  expect(css).not.toContain('.scrollable');
  expect(property('::-webkit-scrollbar', 'width')).toBe('var(--scrollbar-hit)');
  expect(property('::-webkit-scrollbar', 'height')).toBe('var(--scrollbar-hit)');
  expect(property('::-webkit-scrollbar-thumb', 'background-color')).toBe('var(--scrollbar-rest)');
  expect(property('[data-scrolling]::-webkit-scrollbar-thumb', 'background-color')).toBe('var(--accent)');
  expect(property('::-webkit-scrollbar-track', 'background')).toBe('transparent');
});

test('the strip of every scrollbar is wider than its thumb, shows under the pointer and grows the thumb there', () => {
  const thumb = (state: string) => property(`::-webkit-scrollbar-thumb${state}`, 'border-width');
  expect(thumb('')).toBe('calc((var(--scrollbar-hit) - var(--scrollbar-width)) / 2)');
  expect(thumb(':hover')).toBe('calc((var(--scrollbar-hit) - var(--scrollbar-grab)) / 2)');
  expect(thumb(':active')).toBe(thumb(':hover'));
  expect(property('::-webkit-scrollbar-track:hover', 'background')).toContain('var(--text-rgb)');
  expect(property('::-webkit-scrollbar-thumb:active', 'background-color')).toBe('var(--accent)');
  expect(property('::-webkit-scrollbar-thumb', 'background-clip')).toBe('padding-box');
  const vars = computeAppearance({ ...SETTING_DEFAULTS }).vars;
  expect(property(':root', '--scrollbar-hit')).toBe(vars['--scrollbar-hit']);
  expect(property(':root', '--scrollbar-grab')).toBe(vars['--scrollbar-grab']);
  expect(property(':root', '--scrollbar-rest')).toBe(vars['--scrollbar-rest']);
});

test('player controls scale with text size, icon size, and controls size', () => {
  const text = ['.playerUI__title', '.playerProgress__time'];
  const icon = ['.playerUI__button', '.playerUI__button svg', '.playerProgress__bar', '.playerProgress__thumb::before'];
  for (const selector of text) {
    expect(property(selector, 'font-size'), selector).toContain('var(--text-scale');
    expect(property(selector, 'font-size'), selector).toContain('var(--osd-scale');
  }
  for (const selector of icon) {
    const size = property(selector, selector.includes('bar') ? 'height' : 'width');
    expect(size, selector).toContain('var(--icon-scale');
    expect(size, selector).toContain('var(--osd-scale');
  }
});

test('the home rows scroll like a page inside the area below the preview', () => {
  expect(property('.embla__viewport.homeRows', 'overflow-y')).toBe('auto');
  expect(property('.embla__viewport.homeRows', 'overflow-x')).toBe('hidden');
  expect(property('.embla__viewport.homeRows', 'height')).toBe('calc(100vh - var(--content-top))');
  expect(property('.embla__container_vertical', 'height')).toBe('');
});

test('the home bar runs along the right edge of the whole screen and shows only while the rows scroll', () => {
  expect(property('.embla__viewport.homeRows::-webkit-scrollbar', 'width')).toBe('0');
  expect(property('.homeScroll', 'position')).toBe('fixed');
  for (const edge of ['top', 'right', 'bottom']) expect(property('.homeScroll', edge), edge).toBe('0');
  expect(property('.homeScroll', 'opacity')).toBe('0');
  expect(property('.homeRows[data-scrolling] + .homeScroll', 'opacity')).toBe('1');
  expect(property('.homeScroll', 'pointer-events')).toBe('');
  expect(property('.homeScroll:hover', 'opacity')).toBe('1');
  expect(property('.homeScroll', 'width')).toBe(property('::-webkit-scrollbar', 'width'));
  expect(property('.homeScroll__thumb', 'background')).toBe(property('[data-scrolling]::-webkit-scrollbar-thumb', 'background-color'));
  expect(property('.homeScroll__thumb', 'right')).toBe(`calc((${'var(--scrollbar-hit)'} - var(--scrollbar-width)) / 2)`);
  expect(property('.homeScroll:hover .homeScroll__thumb', 'right')).toBe('calc((var(--scrollbar-hit) - var(--scrollbar-grab)) / 2)');
});

test('a loading animation on a highlighted row is drawn in the colours of that row', () => {
  for (const selector of ['.picker__item--selected .loading-spinner', '.settingsView__control--focused .loading-spinner']) {
    expect(property(selector, '--accent'), selector).toBe('var(--btn-fg)');
    expect(property(selector, '--accent-rgb'), selector).toBe('var(--btn-fg-rgb)');
    expect(property(selector, '--bg'), selector).toBe('var(--btn-bg)');
    expect(property(selector, '--bg-rgb'), selector).toBe('var(--btn-bg-rgb)');
  }
});

test('the player buttons keep their own layer over the video and fade their ring like the rest of their highlight', () => {
  expect(property('.playerUI', 'will-change')).toBe('opacity');
  expect(property('.playerUI__button', 'will-change')).toBe('transform');
  const transition = property('.playerUI__button', 'transition');
  for (const name of ['background-color', 'color', 'box-shadow', 'transform']) expect(transition, name).toContain(name);
});

test('the buffering spinner is drawn above the player controls so their cover does not dim it', () => {
  expect(Number(property('.player-buffering', 'z-index'))).toBeGreaterThan(Number(property('.playerUI', 'z-index')));
  expect(property('.player-buffering', 'pointer-events')).toBe('none');
});

test('the cursor goes away with the hidden player controls and the controls stop taking the pointer', () => {
  expect(property('.player-wrapper--controls-hidden', 'cursor')).toBe('none');
  expect(property('.player-wrapper--controls-hidden .playerUI', 'pointer-events')).toBe('none');
});

test('the watched progress on a tile takes its track from the theme and follows the corners of the tile', () => {
  expect(property('.embla__slide__progress::before', 'background')).toBe('var(--rail-glow), var(--bg)');
  expect(property('.embla__slide__progress', 'border-radius')).toContain('var(--border-radius-lg) - var(--border-width)');
  expect(property('.embla__slide__progressFill', 'background')).toBe('var(--accent)');
});

test('the progress handle is moved by a transform and lights up like the keyboard focus when the pointer is on the bar', () => {
  expect(property('.playerProgress__thumb', 'width')).toBe('100%');
  expect(property('.playerProgress__thumb', 'left')).toBe('0');
  expect(property('.playerProgress__thumb', 'will-change')).toBe('transform');
  const focused = declarations('.playerProgress__thumb--focused::before');
  expect(declarations('.playerProgress__barWrapper:hover .playerProgress__thumb::before')).toBe(focused);
  expect(focused).toContain('transform: scale(1.2)');
  for (const handle of ['round', 'pill']) {
    expect(declarations(`html[data-osd-handle='${handle}'] .playerProgress__barWrapper:hover .playerProgress__thumb::before`)).toBe(declarations(`html[data-osd-handle='${handle}'] .playerProgress__thumb--focused::before`));
  }
  expect(declarations("html[data-osd-bar='neutral'] .playerProgress__barWrapper:hover .playerProgress__thumb::before")).toBe(declarations("html[data-osd-bar='neutral'] .playerProgress__thumb--focused::before"));
});

test('the watched track of a tile looks like the side navigation for every rail style, and glass has no shine', () => {
  const rail = (selector: string) => property(selector, 'background');
  expect(rail('.active .embla__slide__progress::before')).toBe(rail('.sidebar--focused'));
  expect(rail("html[data-rail='panel'] .embla__slide__progress::before")).toBe(rail("html[data-rail='panel'] .sidebar:not(.sidebar--focused)"));
  expect(rail("html[data-rail='panel'] .active .embla__slide__progress::before")).toBe(rail("html[data-rail='panel'] .sidebar--focused"));
  expect(rail("html[data-rail='glass'] .embla__slide__progress::before")).toBe('var(--glass-flat-bg)');
  expect(property('html', '--glass-flat-bg')).toBe(property("html[data-shine='flat']", '--glass-rail-bg'));
  expect(property('html', '--glass-glow-flat')).toBe(property("html[data-shine='flat']", '--glass-glow'));
  expect(declarations("html[data-rail='glass'] .embla__slide__progress::before")).toContain('backdrop-filter: blur(var(--glass-blur)) saturate(150%)');
  expect(declarations("html[data-rail='glass'] .active .embla__slide__progress::before")).toContain('rgba(var(--bg-rgb), var(--glass-drawer-blur))');
  expect(declarations("html[data-rail='glass'] .active .embla__slide__progress::before")).toContain('rgba(var(--bg-rgb), var(--glass-drawer))');
  expect(rail("html[data-canvas='glow'][data-rail='transparent'] .active .embla__slide__progress::before")).toBe(rail("html[data-canvas='glow'][data-rail='transparent'] .sidebar--focused"));
  for (const selector of ['.embla__slide__progress::before', "html[data-rail='glass'] .embla__slide__progress::before"]) expect(declarations(selector)).not.toMatch(/rgba\(255, 255, 255/);
  expect(Number(property('.embla__slide__progress::before', 'opacity'))).toBeLessThanOrEqual(0.5);
  expect(property('.embla__slide__progressFill', 'position')).toBe('relative');
});

test('the scrollbar of a popup list stays visible and turns to the accent while it scrolls', () => {
  for (const list of ['.picker__list', '.picker__grid']) {
    expect(property(`${list}::-webkit-scrollbar-thumb`, 'background-color')).toBe('rgba(var(--text-rgb), 0.3)');
    expect(property(`${list}[data-scrolling]::-webkit-scrollbar-thumb`, 'background-color')).toBe('var(--accent)');
  }
});

test('nothing in the side menu can scroll it sideways because the logo and the labels that reach out of it are clipped', () => {
  for (const selector of ['.sidebar__brand', '.sidebarItem']) expect(property(selector, 'overflow'), selector).toBe('hidden');
  expect(property('.sidebar', 'overflow-x')).toBe('hidden');
});

test('the Home preview box is a widescreen box in the top right corner that is large enough to see the video', () => {
  const width = parseFloat(property(':root', '--preview-width'));
  const height = parseFloat(property(':root', '--preview-height'));
  expect(width).toBe(1452);
  expect(Math.abs(width / height - 16 / 9)).toBeLessThan(0.005);
  expect([property('.preview', 'position'), property('.preview', 'top'), property('.preview', 'right')]).toEqual(['fixed', '0', '0']);
  expect(property('.previewOverlay', 'height')).toBe('var(--preview-height)');
});

test('the fade over the preview picture is a mask that is strong at the left and the bottom and ends early at the top right, so the glow of a theme stays out of the free part', () => {
  const mask = property('.previewOverlay', '-webkit-mask-image');
  expect(mask).toContain('#000 60%, rgba(0, 0, 0, 0.5) 72%, transparent 84%');
  expect(mask).toContain('#000 40%, rgba(0, 0, 0, 0.5) 58%, transparent 76%');
  expect(property('.previewOverlay', 'background')).toBe('var(--bg)');
  expect(property("html[data-canvas='glow'] .previewOverlay", 'background')).toBe('var(--canvas), var(--bg)');
  expect(css).not.toContain('.previewOverlay::after');
});

test('the side menu cannot be reached through the player of a screen and the layout does not change while it plays', () => {
  expect(property('.appShell--playing .appShell__nav', 'pointer-events')).toBe('none');
  expect(declarations('.appShell--playing')).toBe('');
  expect(property('.appShell--fullscreen .appShell__main', 'margin-left')).toBe('0');
});

test('the stats panel sits at the top right, ignores the pointer, and stays readable on every theme', () => {
  expect(property('.playerStats', 'position')).toBe('absolute');
  expect(property('.playerStats', 'right')).toContain('vw');
  expect(property('.playerStats', 'pointer-events')).toBe('none');
  expect(property('.playerStats', 'background')).toContain('var(--popup-rgb)');
  expect(property('.playerStats__label', 'color')).toBe('var(--text-muted)');
});

test('the player controls over the video are white on a black scrim in every light theme', () => {
  expect(property("html[data-light='true'] .playerUI", '--text')).toBe('#ffffff');
  expect(property("html[data-light='true'] .playerUI", '--text-rgb')).toBe('255, 255, 255');
  expect(property("html[data-light='true'] .playerUI", '--bg-rgb')).toBe('0, 0, 0');
  expect(property('.playerUI__cover', 'background')).toContain('var(--osd-top, 0.7)) 0%, rgba(var(--bg-rgb), 0) 22%');
});

test('the player title row is at the top left, the back button leads it and the title ellipsizes beside it', () => {
  expect(property('.playerUI__top', 'position')).toBe('absolute');
  expect(property('.playerUI__top', 'top')).toContain('vw');
  expect(property('.playerUI__top', 'left')).toContain('vw');
  expect(property('.playerUI__top', 'right')).toContain('vw');
  expect(property('.playerUI__top', 'display')).toBe('flex');
  expect(property('.playerUI__back', 'position')).toBe('');
  expect(property('.playerUI__back', 'margin-right')).toContain('vw');
  expect(property('.playerUI__meta', 'min-width')).toBe('0');
  expect(property('.playerUI__title', 'text-overflow')).toBe('ellipsis');
});

test('the side menu indicator draws a line, a frame, or a contrast fill, and never marks the logo entry', () => {
  const line = '.sidebarItem--selected:not(.sidebarItem--brand):not(.sidebarItem--highlighted)::before';
  const selected = '.sidebarItem--selected:not(.sidebarItem--highlighted):not(.sidebarItem--brand)';
  expect(property(line, 'width')).toBe('var(--border-width)');
  expect(property(line, 'background')).toBe('var(--accent-stroke)');
  expect(property(line, 'left')).toBe('14px');
  const largeScreenRules = [...css.slice(0, css.indexOf('@media (max-width: 900px)')).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => match[1].split(',').map((selector) => selector.trim()));
  expect(largeScreenRules.filter((selectors) => selectors.some((selector) => selector.endsWith('::before') && selector.includes('sidebarItem--highlighted') && !selector.includes(':not(.sidebarItem--highlighted)')))).toEqual([]);
  for (const mode of ['off', 'border', 'contrast']) expect(property(`html[data-nav-indicator='${mode}'] .sidebarItem--selected::before`, 'display'), mode).toBe('none');
  expect(property(`html[data-nav-indicator='border'] ${selected}`, 'box-shadow')).toContain('var(--border-width)');
  expect(property(`html[data-nav-indicator='border'] ${selected}`, 'box-shadow')).toContain('var(--accent-stroke)');
  expect(property(`html[data-nav-indicator='contrast'] ${selected}`, 'background-color')).toBe('var(--nav-fill)');
  expect(property(`html[data-nav-indicator='contrast'] ${selected} .sidebarItem__icon`, 'color')).toBe('var(--nav-fill-fg)');
  expect(property("html[data-rail='glass'] .sidebar::after", 'z-index')).toBe('-1');
  expect(property(':root', '--nav-inset-left')).toBe('0px');
  expect(property(':root', '--nav-inset-right')).toBe('0px');
  for (const mode of ['border', 'contrast']) {
    expect(property(`html[data-nav-indicator='${mode}']`, '--nav-inset-left'), mode).toBe('10px');
    expect(property(`html[data-nav-indicator='${mode}']`, '--nav-inset-right'), mode).toBe('4px');
  }
  expect(property('.sidebarItem__icon', 'margin-left')).toBe('');
  const marks = rules.filter((rule) => /sidebarItem--selected/.test(rule.selectors.join()) && /(::before|box-shadow|background-color)/.test(rule.body) && !/display\s*:\s*none/.test(rule.body));
  for (const rule of marks) for (const selector of rule.selectors) expect(selector, selector).toContain(':not(.sidebarItem--brand)');
});

test('the contrast indicator keeps its label free of the glass shadow and hover is left to the pointer selection', () => {
  const glass = "html[data-rail='glass'] .sidebar--focused .sidebarItem:not(.sidebarItem--highlighted) .sidebarItem__label";
  const clear = "html[data-nav-indicator='contrast'] .sidebarItem--selected:not(.sidebarItem--highlighted):not(.sidebarItem--brand) .sidebarItem__label";
  const order = (selector: string, declaration = '') => rules.findIndex((rule) => rule.selectors.includes(selector) && rule.body.includes(declaration));
  expect(property(clear, 'text-shadow')).toBe('none');
  expect(order(clear, 'text-shadow')).toBeGreaterThan(order(glass, 'text-shadow'));
  for (const selector of ['.listItem:hover', '.conferenceView__gridItem:hover', '.sidebarItem:hover']) expect(order(selector), selector).toBe(-1);
  for (const selector of ['.embla__slide', '.picker__item', '.picker__swatch']) expect(property(selector, 'cursor'), selector).toBe('pointer');
});

test('appearance settings write the variables the scaling rules read', () => {
  const vars = computeAppearance({ ...SETTING_DEFAULTS, textScale: 1.5, iconScale: 1.3, osdScale: 2, borderWidth: 3 }).vars;
  expect(vars['--text-scale']).toBe('1.8');
  expect(vars['--icon-scale']).toBe('1.43');
  expect(vars['--osd-scale']).toBe('2');
  expect(vars['--border-width']).toBe('3px');
});

test('subtitles and their preview follow the size factor of the chosen font', () => {
  for (const size of ['small', 'medium', 'large']) {
    expect(property(`html[data-subtitle-size="${size}"] video::cue`, 'font-size'), size).toContain('var(--sub-scale');
    expect(property(`html[data-subtitle-size="${size}"] .settingsView__subtitlePreview span`, 'font-size'), size).toContain('var(--sub-scale');
  }
});

test('the scrollbar of a popup list sits at the edge of the popup and takes the sizes of every other scrollbar', () => {
  for (const selector of ['.picker__list', '.picker__grid']) {
    expect(property(selector, 'margin-right'), selector).toBe('-2.4rem');
    expect(property(selector, 'padding-right'), selector).toBe('2.4rem');
    expect(property(`${selector}::-webkit-scrollbar`, 'width'), selector).toBe('');
    expect(property(`${selector}::-webkit-scrollbar-thumb`, 'border-width'), selector).toBe('');
    expect(property(`${selector}::-webkit-scrollbar-thumb:hover`, 'background-color'), selector).toContain('var(--text-rgb)');
    expect(property(`${selector}::-webkit-scrollbar-thumb:active`, 'background-color'), selector).toBe('var(--accent)');
  }
});

test('the title and the description of the preview stay at three lines even where the line clamp is not applied', () => {
  expect(property('.previewDescription', '-webkit-line-clamp')).toBe('3');
  expect(property('.previewDescription', 'overflow')).toBe('hidden');
  expect(property('.previewDescription', 'max-height')).toBe(`calc(3 * ${property('.previewDescription', 'line-height')}em)`);
  expect(property('.preview-title', '-webkit-line-clamp')).toBe('3');
  expect(property('.preview-title', 'overflow')).toBe('hidden');
  expect(property('.preview-title', 'max-height')).toBe(`calc(3 * ${property('.preview-title', 'line-height').replace(' !important', '')}em)`);
});

test('a closing player shows the page at once, its layer turns transparent, its content hides and the pointer passes through', () => {
  expect(property('html[data-player-closing] .player-fullscreen-container', 'background-color')).toBe('transparent');
  expect(property('html[data-player-closing] .player-fullscreen-container', 'pointer-events')).toBe('none');
  expect(property('.player-wrapper--closing', 'background')).toBe('transparent');
  expect(property('.player-wrapper--closing > *', 'visibility')).toBe('hidden');
});

test('the cat on the About page moves only while it is marked as moving, because its animation keeps the GPU of the TV busy', () => {
  expect(property('.settingsView .settingsView__cat .voctocat div', 'animation-play-state')).toBe('paused');
  expect(property('.settingsView .settingsView__cat[data-moving] .voctocat div', 'animation-play-state')).toBe('running');
  expect(property('.settingsView .settingsView__cat .voctocat div', 'animation')).toBe('');
});

test('the tab list and the page of Settings are separate layers, one shared layer shows stale pictures on the TV', () => {
  expect(property('.settingsView__tabs', 'will-change')).toBe('transform');
  expect(property('.settingsView__content', 'will-change')).toBe('transform');
});

