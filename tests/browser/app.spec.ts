import { test, expect, type Page } from '@playwright/test';
const { fixture } = require('./fixtures.cjs') as { fixture: (url: string, body?: string) => { contentType: string; body: string | Buffer } | null };

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).hostname === '127.0.0.1') { await route.continue(); return; }
    const response = fixture(request.url(), request.postData() || undefined);
    if (!response) throw Error(`Unexpected external request: ${request.url()}`);
    await route.fulfill({ ...response, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
});

test('starts, loads lazy pages, and preserves the home selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 0');
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await expect(page.locator('.searchContainer')).toBeVisible();
  await page.locator('.sidebarItem').filter({ hasText: 'Home' }).click();
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 0');
  for (const [label, selector] of [['Popular', '.popularView'], ['Events', '.eventsListView'], ['Watchlist', '.watchlistView']]) {
    await page.locator('.sidebarItem').filter({ hasText: label }).click();
    await expect(page.locator(selector)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('loads the CDN mirror ranking in the background and skips the dead mirror', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mirror_ranking'))).not.toBeNull();
  const bases = await page.evaluate(() => JSON.parse(localStorage.getItem('mirror_ranking')!).mirrors.map((mirror: { base: string }) => mirror.base));
  expect(bases).toEqual(['https://ffmuc.media.ccc.de/', 'https://ftp.fau.de/cdn.media.ccc.de/']);
});

test('searches, plays real video, and persists the watchlist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await expect(page.locator('.searchResults .listItem')).toHaveCount(1);
  await page.locator('.searchResults .listItem').click();
  const video = page.locator('video.player-video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Add to Watchlist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'In Watchlist', exact: true })).toBeVisible();
  await page.keyboard.press('MediaPlayPause');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('watchlist') || '[]')[0]?.guid)).toBe('talk');
});

test('applies settings and accepts webOS remote commands', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('remoteControl', '"on"'); });
  await page.goto('/');
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail: { cmd: 'play', link: 'https://media.ccc.de/v/talk' } })));
  await expect(page.locator('video.player-video')).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail: { cmd: 'pause' } })));
  await expect.poll(() => page.evaluate(() => (document.querySelector('video.player-video') as HTMLVideoElement).paused)).toBe(true);
  await expect(page).toHaveTitle('CCCBib - Fixture talk');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail: { cmd: 'stop' } })));
  await expect(page.locator('video.player-video')).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  await page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Theme$/ }) }).locator('.settingsView__select').click();
  await page.locator('.picker__item').getByText('Light', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

async function start(page: Page, settings: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(values => {
    localStorage.clear();
    localStorage.setItem('scaleBase', '1');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, settings);
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0);
}

const size = (page: Page, selector: string, property: 'fontSize' | 'width' | 'height' | 'borderTopWidth') =>
  page.evaluate(([target, name]) => parseFloat(getComputedStyle(document.querySelector(target)!)[name as 'width']), [selector, property]);

test('player controls follow the text, icon, and controls size settings', async ({ page }) => {
  const measure = async (settings: Record<string, unknown>) => {
    await start(page, settings);
    await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
    await page.getByRole('textbox').fill('fixture');
    await page.locator('.searchResults .listItem').click();
    await expect(page.locator('.playerUI__button').first()).toBeAttached();
    return {
      title: await size(page, '.playerUI__title', 'fontSize'),
      button: await size(page, '.playerUI__button', 'width'),
      icon: await size(page, '.playerUI__button svg', 'width'),
      bar: await size(page, '.playerProgress__bar', 'height'),
    };
  };
  const base = await measure({});
  const text = await measure({ textScale: 1.5 });
  const icons = await measure({ iconScale: 1.5 });
  const controls = await measure({ osdScale: 1.5 });
  expect(text.title).toBeCloseTo(base.title * 1.5, 1);
  expect([text.button, text.icon, text.bar]).toEqual([base.button, base.icon, base.bar]);
  expect(icons.button).toBeCloseTo(base.button * 1.5, 1);
  expect(icons.icon).toBeCloseTo(base.icon * 1.5, 1);
  expect(icons.bar).toBeCloseTo(base.bar * 1.5, 1);
  expect(icons.title).toBe(base.title);
  expect(controls.title).toBeCloseTo(base.title * 1.5, 1);
  expect(controls.button).toBeCloseTo(base.button * 1.5, 1);
});

test('black theme popups stay black and tiles share one border width', async ({ page }) => {
  await start(page, { themeMode: 'black', accentColor: '#4CAF50' });
  const homeTile = '.embla__slide__img';
  expect(await size(page, homeTile, 'borderTopWidth')).toBe(5);
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  expect(await size(page, '.settingsView__segment', 'borderTopWidth')).toBe(5);
  const row = (name: string) => page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: new RegExp(`^${name}$`) }) });
  await row('Font').locator('.settingsView__select').click();
  await expect(page.locator('.picker__panel')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.keyboard.press('Escape');
  await row('Border Width').locator('.settingsView__select').click();
  await page.locator('.picker__item').filter({ hasText: '2px' }).click();
  expect(await size(page, '.settingsView__segment', 'borderTopWidth')).toBe(2);
  await page.locator('.sidebarItem').filter({ hasText: 'Home' }).click();
  expect(await size(page, homeTile, 'borderTopWidth')).toBe(2);
});

test('the side menu indicator follows the Indicator setting', async ({ page }) => {
  await start(page, { themeMode: 'black' });
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const selected = page.locator('.sidebarItem--selected');
  const line = () => page.evaluate(() => getComputedStyle(document.querySelector('.sidebarItem--selected')!, '::before').display);
  const choose = (name: string) => page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Indicator$/ }) }).getByText(name, { exact: true }).click();
  expect(await line()).toBe('block');
  await choose('Contrast');
  await expect(selected).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(selected.locator('.sidebarItem__icon')).toHaveCSS('color', 'rgb(0, 0, 0)');
  expect(await line()).toBe('none');
  await choose('Border');
  await expect(selected).toHaveCSS('box-shadow', /inset/);
  await expect(selected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await choose('Off');
  await expect(selected).toHaveCSS('box-shadow', 'none');
  expect(await line()).toBe('none');
  await choose('Line');
  expect(await line()).toBe('block');
});

test('stats for nerds shows the playback details from the player controls and stays after they hide', async ({ page }) => {
  await start(page, { statsForNerds: 'on' });
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  await expect(page.locator('video.player-video')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Stats for Nerds' });
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Stats for Nerds' }).click();
  await expect(panel).toBeVisible();
  for (const text of ['Mirror', 'static.media.ccc.de', 'Resolution', '160x120', 'Buffer', 'Buffer fill', 'Engine']) await expect(panel).toContainText(text);
  await expect.poll(() => panel.textContent()).toMatch(/Position00:00:0[1-9]/);
  await page.waitForTimeout(4500);
  await expect(page.locator('.player-wrapper--controls-hidden')).toHaveCount(1);
  await expect(panel).toBeVisible();
  await page.mouse.move(600, 400);
  await page.getByRole('button', { name: 'Stats for Nerds' }).click();
  await expect(panel).toHaveCount(0);
});

test('the subtitle font App follows the font chosen for the app', async ({ page }) => {
  await start(page, { uiFont: 'console', subtitleFont: 'app' });
  const fonts = () => page.evaluate(() => { const style = getComputedStyle(document.documentElement); return [style.getPropertyValue('--ui-font').trim(), style.getPropertyValue('--sub-font').trim(), style.getPropertyValue('--sub-scale').trim()]; });
  const [app, subtitles, scale] = await fonts();
  expect(app).toContain('Inconsolata');
  expect(subtitles).toBe(app);
  expect(scale).toBe('1.15');
  await page.evaluate(() => localStorage.setItem('uiFont', 'inter'));
  await page.reload();
  await expect(page.locator('.carouselTitle').first()).toBeVisible();
  const [changed, followed, factor] = await fonts();
  expect(changed).toContain("'Inter'");
  expect(followed).toBe(changed);
  expect(factor).toBe('1');
});

test('the page title names the app, then the open conference, then the talk, and goes back as each is left', async ({ page }) => {
  await start(page, {});
  await expect(page).toHaveTitle('CCCBib');
  await page.evaluate(() => (document.querySelector('[data-screen="events"]') as HTMLElement).click());
  await page.locator('.eventsListView__list .listItem').first().click();
  await expect(page.locator('.conferenceView__gridItem').first()).toBeVisible();
  await expect(page).toHaveTitle('CCCBib - Fixture conference 0');
  await page.locator('.conferenceView__gridItem__media').first().click();
  await expect(page.locator('video.player-video')).toBeVisible();
  await expect(page).toHaveTitle('CCCBib - Fixture talk');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('video.player-video')).toHaveCount(0);
  await expect(page).toHaveTitle('CCCBib - Fixture conference 0');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await expect(page.locator('.conferenceView__gridItem')).toHaveCount(0);
  await expect(page).toHaveTitle('CCCBib');
});

test.describe('a long conference', () => {
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`${width} by ${height}: scrolling far renders the rows in view instead of leaving the grid empty`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await start(page, {});
      const lectures = Array.from({ length: 90 }, (_, index) => ({ guid: `many-${index}`, slug: `many-${index}`, title: `Many talk ${index}`, description: '', duration: 600, viewCount: 1, persons: [], conference_title: 'Big conference', images: { thumbUrl: 'https://static.media.ccc.de/fixture.svg', posterUrl: 'https://static.media.ccc.de/fixture.svg' }, videos: [], subtitles: [] }));
      await page.route('https://media.ccc.de/graphql', async (route) => {
        const body = route.request().postData() || '';
        if (!/conference\(/.test(body) || /conferencesRecent|lectureSearch|lectureSubtitles/.test(body)) { await route.fallback(); return; }
        await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ data: { conference: { id: 'conference-0', title: 'Big conference', updatedAt: '2026-01-01', lectures: { nodes: lectures } } } }) });
      });
      await page.evaluate(() => (document.querySelector('[data-screen="events"]') as HTMLElement).click());
      await page.locator('.eventsListView__list .listItem').first().click();
      await expect(page.locator('.conferenceView__gridItem').first()).toBeVisible();
      const visibleTitles = () => page.evaluate(() => {
        const box = document.querySelector('.conferenceView__container')!.getBoundingClientRect();
        return [...document.querySelectorAll('.conferenceView__gridItem')].filter((item) => { const rect = item.getBoundingClientRect(); return rect.bottom > box.top + 20 && rect.top < box.bottom - 20; }).map((item) => item.querySelector('.conferenceView__gridItem__title')!.textContent);
      });
      for (const top of [1500, 4500, 9000, 2000, 0]) {
        await page.evaluate((y) => { document.querySelector('.conferenceView__container')!.scrollTop = y; }, top);
        await expect.poll(async () => (await visibleTitles()).length, { timeout: 3000 }).toBeGreaterThanOrEqual(1);
      }
      await page.evaluate(() => { document.querySelector('.conferenceView__container')!.scrollTop = 7000; });
      await expect.poll(async () => Math.min(...(await visibleTitles()).map((title) => Number(title!.replace('Many talk ', ''))))).toBeGreaterThan(30);
      expect(await page.locator('.conferenceView__gridItem').count()).toBeLessThan(40);
    });
  }
});

test('every loading animation is previewed in its popup in the accent colour and the chosen one is kept', async ({ page }) => {
  await start(page, { accentColor: '#F44336' });
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Loading Animation$/ }) });
  await row.locator('.settingsView__select').click();
  const items = page.locator('.picker__item');
  expect(await items.count()).toBeGreaterThanOrEqual(18);
  const previews = await items.evaluateAll((elements) => elements.map((element) => {
    const spinner = element.querySelector('.loading-spinner') as HTMLElement;
    const parts = [spinner, ...spinner.querySelectorAll('*')] as HTMLElement[];
    return {
      name: element.textContent, width: spinner.getBoundingClientRect().width, height: spinner.getBoundingClientRect().height,
      moving: parts.some((part) => [getComputedStyle(part).animationName, getComputedStyle(part, '::before').animationName, getComputedStyle(part, '::after').animationName].some((name) => name && name !== 'none')),
    };
  }));
  for (const preview of previews) {
    expect(preview.width, preview.name!).toBeGreaterThan(2);
    expect(preview.height, preview.name!).toBeGreaterThan(2);
    expect(preview.moving, preview.name!).toBe(true);
  }
  const terminal = items.filter({ hasText: 'Terminal' });
  expect(await terminal.locator('.loading-spinner').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(244, 67, 54)');
  const retro = items.filter({ hasText: 'Retro Bar' }).locator('.loading-spinner');
  expect(await retro.evaluate((element) => getComputedStyle(element.firstElementChild!).backgroundImage)).toContain('rgb(244, 67, 54)');
  await retro.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spinnerStyle')!))).toBe('retro');
  await expect(row.locator('.settingsView__selectName')).toHaveText('Retro Bar');
});

test('the startup screen shows the chosen loading animation before the app has loaded', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('appearance_boot', JSON.stringify({ attrs: { 'data-loader': 'defrag' }, vars: { '--accent': '#F44336', '--accent-rgb': '244, 67, 54' } })));
  await page.route('**/app.bundle.js', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  const boot = page.locator('#boot .loader-defrag');
  await expect(boot).toBeVisible();
  await expect(boot.locator('i')).toHaveCount(15);
  expect(await boot.evaluate((element) => getComputedStyle(element).display)).toBe('grid');
  expect(await boot.locator('i').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('loader-cell');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 15000 });
});

async function bootStyle(page: Page, cached: Record<string, unknown>) {
  await page.addInitScript((value) => localStorage.setItem('appearance_boot', JSON.stringify(value)), cached);
  await page.route('**/app.bundle.js', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  const boot = page.locator('#boot');
  await expect(boot).toBeVisible();
  const style = await boot.evaluate((element) => ({ image: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).backgroundColor }));
  await expect(boot).toHaveCount(0, { timeout: 15000 });
  return style;
}

test('the startup screen shows the glow of the theme and not just a flat colour', async ({ page }) => {
  const style = await bootStyle(page, { attrs: { 'data-theme': 'sunset', 'data-canvas': 'glow', 'data-loader': 'wheel' }, vars: { '--bg': '#1c142e', '--accent': '#FF9800', '--accent-rgb': '255, 152, 0' } });
  expect(style.image).toContain('radial-gradient');
  expect(style.image).toContain('rgba(255, 152, 0');
  expect(style.color).toBe('rgb(28, 20, 46)');
});

test('the startup screen of a theme without a glow stays a flat colour', async ({ page }) => {
  const style = await bootStyle(page, { attrs: { 'data-theme': 'dark', 'data-canvas': 'none' }, vars: { '--bg': '#141517' } });
  expect(style.image).toBe('none');
  expect(style.color).toBe('rgb(20, 21, 23)');
});

test('marked text takes the accent colour and a readable text colour', async ({ page }) => {
  await start(page, { accentColor: '#F44336' });
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  const input = page.getByRole('textbox');
  await input.fill('fixture');
  await input.selectText();
  const colours = await input.evaluate((element) => ({ background: getComputedStyle(element, '::selection').backgroundColor, color: getComputedStyle(element, '::selection').color }));
  expect(colours).toEqual({ background: 'rgb(244, 67, 54)', color: 'rgb(255, 255, 255)' });
});

test('the preview shows the picture of the selected talk and never plays a video, and Off hides the picture', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await expect(page.locator('.previewBackdrop__img').first()).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator('.preview video')).toHaveCount(0);
  await start(page, { previewImage: 'none' });
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await expect(page.locator('.previewBackdrop')).toHaveCount(0);
  await start(page, { previewVideo: 'mute' });
  await expect(page.locator('.previewBackdrop__img').first()).toBeVisible();
  await expect(page.locator('.preview video')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu is a bar at the top, the text follows the width and no page scrolls sideways', async ({ page }) => {
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    const bar = (await page.locator('.sidebar').boundingBox())!;
    expect([bar.x, bar.y, bar.width, bar.height]).toEqual([0, 0, 390, 56]);
    await expect(page.locator('.sidebarItem--brand')).toBeVisible();
    await expect(page.locator('.sidebar__brand')).toHaveCount(0);
    await expect(page.locator('.sidebarItem').filter({ hasText: 'Home' })).toHaveCount(0);
    const cells = await page.locator('.sidebar .sidebarItem').evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().width)));
    expect(cells).toHaveLength(6);
    expect(Math.max(...cells) - Math.min(...cells)).toBeLessThanOrEqual(1);
    const root = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(root).toBeGreaterThan(6);
    expect(root).toBeLessThan(11);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.locator('.sidebarItem--bottom').click();
    await expect(page.locator('.settingsView')).toBeVisible();
    const tabs = (await page.locator('.settingsView__tabs').boundingBox())!;
    const content = (await page.locator('.settingsView__content').boundingBox())!;
    expect(tabs.width).toBe(390);
    expect(content.y).toBeGreaterThanOrEqual(tabs.y + tabs.height);
    const edges = await page.locator('.settingsView__tab').evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return [Math.round(box.left), Math.round(box.right), Math.round(box.width)]; }));
    expect(edges).toHaveLength(5);
    for (const [left, right, width] of edges) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(390);
      expect(width).toBe(edges[0][2]);
    }
    expect(await page.locator('.settingsView__tabLabel').evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth + 1))).toBe(true);
  });
});

test.describe('tiles by screen width', () => {
  const cases = [[390, 346, 1], [700, 313, 2]] as const;
  for (const [width, tile, columns] of cases) {
    test(`${width} px wide shows ${columns} ${columns === 1 ? 'column' : 'columns'} of tiles and no preview`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page, {});
      await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
      expect(Math.round((await page.locator('.embla__slide.active').first().boundingBox())!.width)).toBeCloseTo(tile, 0);
      await expect(page.locator('.embla__slide__description').first()).toHaveText('Fixture description');
      await expect(page.locator('.preview-title')).toHaveCount(0);
      await page.evaluate(() => (document.querySelector('[data-screen="events"]') as HTMLElement).click());
      await page.locator('.eventsListView__list .listItem').first().click();
      await expect(page.locator('.conferenceView__gridItem').first()).toBeVisible();
      const tops = await page.locator('.conferenceView__gridItem').evaluateAll((items) => items.slice(0, 4).map((item) => Math.round(item.getBoundingClientRect().top)));
      expect(tops.filter((top) => top === tops[0])).toHaveLength(columns);
      await expect(page.locator('.conferenceView__gridItem__description').first()).toHaveText('Fixture description');
    });
  }
});

test.describe('player controls on small screens', () => {
  for (const [width, height] of [[390, 844], [320, 640], [700, 900], [844, 390]]) {
    test(`${width} by ${height}: no button overlaps another or leaves the screen and the skips sit left and right of a centred play button`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await start(page, {});
      await page.evaluate(() => (document.querySelector('[data-screen="search"]') as HTMLElement).click());
      await page.getByRole('textbox').fill('fixture');
      await page.locator('.searchResults .listItem').click();
      await expect(page.locator('video.player-video')).toBeVisible();
      const boxes = await page.locator('.playerUI__button').evaluateAll((buttons) => buttons.map((button) => { const box = button.getBoundingClientRect(); return { label: button.getAttribute('aria-label'), left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }));
      expect(boxes.length).toBeGreaterThanOrEqual(7);
      for (const box of boxes) {
        expect(box.left, box.label!).toBeGreaterThanOrEqual(0);
        expect(box.right, box.label!).toBeLessThanOrEqual(width);
        expect(box.bottom, box.label!).toBeLessThanOrEqual(height);
        expect(box.right - box.left, box.label!).toBeGreaterThanOrEqual(40);
      }
      for (const [index, first] of boxes.entries()) {
        for (const second of boxes.slice(index + 1)) {
          const apart = first.right <= second.left + 0.5 || second.right <= first.left + 0.5 || first.bottom <= second.top + 0.5 || second.bottom <= first.top + 0.5;
          expect(apart, `${first.label} and ${second.label}`).toBe(true);
        }
      }
      if (height < 500) expect(await page.locator('.playerUI__title').evaluate((title) => parseFloat(getComputedStyle(title).fontSize))).toBeLessThanOrEqual(34);
      await expect(page.locator('.playerUI__title')).toHaveText('Fixture talk');
      await expect(page.locator('.playerUI__subtitle')).toHaveCount(0);
      const title = await page.locator('.playerUI__title').evaluate((element) => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top, bottom: box.bottom }; });
      const lowest = Math.min(...boxes.filter((box) => box.label !== 'Back').map((box) => box.top));
      expect(title.top, 'the title is on top').toBeLessThan(height * 0.2);
      expect(title.bottom, 'the title is above the controls').toBeLessThanOrEqual(lowest + 0.5);
      const backBox = boxes.find((box) => box.label === 'Back');
      if (backBox) expect(title.left, 'the title is next to the back button').toBeGreaterThanOrEqual(backBox.right);
      else expect(title.left, 'the title is left aligned').toBeLessThan(width * 0.1);
      const skip = boxes.find((box) => box.label === 'Skip Back')!;
      const pause = boxes.find((box) => box.label === 'Pause')!;
      const forward = boxes.find((box) => box.label === 'Skip Forward')!;
      expect(Math.abs((pause.left + pause.right) / 2 - width / 2)).toBeLessThan(2);
      expect(Math.abs((skip.left + forward.right) / 2 - width / 2)).toBeLessThan(2);
      const gap = Math.min(pause.left - skip.right, forward.left - pause.right);
      expect(gap, 'distance between play and a skip button').toBeGreaterThanOrEqual(26);
    });
  }
});

test.describe('screens on small widths', () => {
  const screens = [['Home', 'recent'], ['Search', 'search'], ['Popular', 'popular'], ['Events', 'events'], ['Watchlist', 'watchlist'], ['Settings', 'settings']];
  for (const width of [390, 700, 820]) {
    test(`${width} px wide: no screen scrolls sideways and the content starts below the bar`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page, {});
      await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
      const bar = (await page.locator('.sidebar').boundingBox())!;
      for (const [name, id] of screens) {
        await page.evaluate((target) => (document.querySelector(`[data-screen="${target}"]`) as HTMLElement).click(), id);
        await page.waitForTimeout(400);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name).toBe(width);
        const extent = await page.evaluate(() => { const boxes = [...document.querySelectorAll('.popularView, .eventsListView, .watchlistView, .settingsView, .searchContainer, .homeRows')].map((element) => element.getBoundingClientRect()); return { top: Math.min(...boxes.map((box) => box.top)), bottom: Math.max(...boxes.map((box) => box.bottom)) }; });
        const markBox = await page.evaluate((target) => { const style = getComputedStyle(document.querySelector(`[data-screen="${target}"]`)!, '::before'); return { width: parseFloat(style.width), height: parseFloat(style.height), bottom: style.bottom }; }, id);
        expect(markBox.width, `${name} mark`).toBeGreaterThanOrEqual(20);
        expect(markBox.height, `${name} mark`).toBeLessThanOrEqual(6);
        expect(markBox.bottom, `${name} mark`).toBe('0px');
        expect(extent.top, name).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
        expect(extent.bottom, name).toBeLessThanOrEqual(900 + 1);
      }
    });

    test(`${width} px wide: the whole search hint fits into the search field`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page, {});
      await page.evaluate(() => (document.querySelector('[data-screen="search"]') as HTMLElement).click());
      const input = page.getByRole('textbox');
      await expect(input).toBeVisible();
      const fit = await input.evaluate((element: HTMLInputElement) => {
        const style = getComputedStyle(element);
        const context = document.createElement('canvas').getContext('2d')!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return { text: context.measureText(element.placeholder).width, room: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), size: parseFloat(style.fontSize) };
      });
      expect(fit.text).toBeLessThanOrEqual(fit.room);
      expect(fit.size).toBeGreaterThanOrEqual(14);
      expect(fit.size).toBeLessThanOrEqual(24);
    });

    test(`${width} px wide: lists use the width and a settings control sits on the right of its label`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page, {});
      await page.evaluate(() => (document.querySelector('[data-screen="popular"]') as HTMLElement).click());
      const list = page.locator('.popularView__list');
      await expect(list.locator('.listItem').first()).toBeVisible();
      expect(await list.evaluate((element) => getComputedStyle(element).paddingRight)).toBe('16px');
      const item = (await list.locator('.listItem').first().boundingBox())!;
      expect(item.x + item.width).toBeGreaterThan(width - 40);
      await page.evaluate(() => (document.querySelector('.sidebarItem--bottom') as HTMLElement).click());
      const row = page.locator('.settingsView__row').first();
      const [label, control] = await Promise.all([row.locator('.settingsView__rowLabel').boundingBox(), row.locator('.settingsView__select').boundingBox()]);
      expect(control!.x).toBeGreaterThan(label!.x + label!.width * 0.4);
      expect(control!.y).toBeLessThan(label!.y + label!.height);
      expect(control!.x + control!.width).toBeLessThanOrEqual(width - 8);
    });
  }
});

test('the aspect button follows the shape of the window and each mode fills the window as on the TV', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await start(page, {});
  await page.evaluate(() => (document.querySelector('[data-screen="search"]') as HTMLElement).click());
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  const video = page.locator('video.player-video');
  await expect(video).toBeVisible();
  const aspect = page.getByRole('button', { name: /^Aspect:/ });
  await expect(aspect).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 1000 });
  await expect(aspect).toBeVisible();
  for (const [name, fit] of [['Zoom', 'cover'], ['Stretch', 'fill'], ['Auto', 'contain']]) {
    await aspect.click();
    await page.locator('.picker__item', { hasText: name }).click();
    await expect(video).toHaveCSS('object-fit', fit);
    const box = (await video.boundingBox())!;
    expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 1000, 1000]);
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await expect(aspect).toHaveCount(0);
});

test.describe('rotating a phone or a tablet', () => {
  const slides = (page: Page) => page.locator('.embla__slide.active').first().evaluate((slide) => Math.round(slide.getBoundingClientRect().width));
  const bar = (page: Page) => page.locator('.sidebar').boundingBox();

  test('the layout follows the orientation without a reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    expect(await slides(page)).toBe(346);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => slides(page)).toBe(Math.round((844 - 64) / 3.1));
    const sideways = (await bar(page))!;
    expect([sideways.x, sideways.y, sideways.width, sideways.height]).toEqual([0, 0, 844, 48]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => slides(page)).toBe(346);
    expect((await bar(page))!.height).toBe(56);
  });

  test('a tablet held sideways keeps the side menu and scales its tiles', async ({ page }) => {
    for (const [width, height] of [[1024, 768], [1180, 820]]) {
      await page.setViewportSize({ width, height });
      await start(page, {});
      await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
      const menu = (await bar(page))!;
      expect([menu.x, menu.y, menu.height]).toEqual([0, 0, height]);
      expect(await slides(page)).toBe(Math.round((width - 130) / 2.5));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
  });
});

test.describe('touch screens', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('tiles and rows look the same everywhere, nothing is dimmed or highlighted until it is pressed, and the logo is Home', async ({ page }) => {
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    const tiles = await page.locator('.embla__slide__img').evaluateAll((images) => images.slice(0, 4).map((image) => { const style = getComputedStyle(image); return [style.opacity, style.borderTopColor, style.boxShadow]; }));
    expect(new Set(tiles.map((tile) => tile.join('|'))).size).toBe(1);
    expect(tiles[0][0]).toBe('1');
    expect(tiles[0][2]).toBe('none');
    const titles = await page.locator('.embla__slide__title').evaluateAll((items) => items.slice(0, 3).map((item) => getComputedStyle(item).color));
    expect(new Set(titles).size).toBe(1);
    await page.evaluate(() => (document.querySelector('[data-screen="popular"]') as HTMLElement).click());
    await expect(page.locator('.popularView__list .listItem').first()).toBeVisible();
    const rows = await page.locator('.popularView__list .listItem').evaluateAll((items) => items.slice(0, 3).map((item) => { const style = getComputedStyle(item); return [style.backgroundColor, style.borderTopColor]; }));
    expect(new Set(rows.map((row) => row.join('|'))).size).toBe(1);
    await page.locator('.sidebarItem--brand').click();
    await expect(page.locator('.carouselTitle').first()).toBeVisible();
    expect(await page.locator('.sidebarItem--highlighted').count()).toBe(0);
  });

  test('only the picture of a tile starts a video, tapping its text does not', async ({ page }) => {
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    const centre = async (selector: string) => { const box = (await page.locator(selector).first().boundingBox())!; return [box.x + box.width / 2, box.y + box.height / 2] as const; };
    const [textX, textY] = await centre('.embla__slide.active .embla__slide__title');
    await page.touchscreen.tap(textX, textY);
    const [metaX, metaY] = await centre('.embla__slide.active .embla__slide__description');
    await page.touchscreen.tap(metaX, metaY);
    await page.waitForTimeout(700);
    await expect(page.locator('video.player-video')).toHaveCount(0);
    const [pictureX, pictureY] = await centre('.embla__slide.active .embla__slide__media');
    await page.touchscreen.tap(pictureX, pictureY);
    await expect(page.locator('video.player-video')).toBeVisible();
  });

  test('a tablet held sideways does not dim its tiles either', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    expect(await page.locator('.embla__slide__img').nth(1).evaluate((image) => getComputedStyle(image).opacity)).toBe('1');
  });
});

test('with a mouse a narrow window still marks the selected tile but never dims the others', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  expect(await page.locator('.embla__slide__img').nth(1).evaluate((image) => getComputedStyle(image).opacity)).toBe('1');
  const border = (selector: string) => page.locator(selector).first().evaluate((image) => getComputedStyle(image).borderTopColor);
  expect(await border('.embla__slide.active .embla__slide__img')).not.toBe(await border('.embla__slide.active + .embla__slide .embla__slide__img'));
});

test('pointing at an icon of the top bar only colours that icon, the bar itself never brightens or grows', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const look = (selector: string) => page.locator(selector).evaluate((element) => { const css = getComputedStyle(element); const icon = getComputedStyle(element.querySelector('.sidebarItem__icon') || element); return { background: css.backgroundColor, shadow: css.boxShadow, icon: icon.color, width: element.getBoundingClientRect().width }; });
  const barBefore = await look('.sidebar');
  const before = await look('[data-screen="popular"]');
  const cell = (await page.locator('[data-screen="popular"]').boundingBox())!;
  await page.mouse.move(cell.x + 10, cell.y + 10);
  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
  await expect(page.locator('[data-screen="popular"].sidebarItem--highlighted')).toHaveCount(1);
  await expect(page.locator('.sidebar--focused')).toHaveCount(0);
  expect(await look('.sidebar')).toEqual(barBefore);
  const after = await look('[data-screen="popular"]');
  expect(after.background).toBe('rgba(0, 0, 0, 0)');
  expect(after.shadow).toBe('none');
  expect(after.width).toBe(before.width);
  expect(after.icon).not.toBe(before.icon);
  const home = page.locator('[data-screen="recent"]');
  const mark = (selector: string) => page.evaluate((target) => getComputedStyle(document.querySelector(target)!, '::before').content, selector);
  const homeCell = (await home.boundingBox())!;
  await page.mouse.move(homeCell.x + 10, homeCell.y + 10);
  await page.mouse.move(homeCell.x + homeCell.width / 2, homeCell.y + homeCell.height / 2);
  await expect(home).toHaveClass(/sidebarItem--highlighted/);
  expect(await mark('[data-screen="recent"]')).toBe('""');
});

test('on a small screen the Settings tabs look like the menu bar, with names, a mark under the active one and a colour on press', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, {});
  await page.evaluate(() => (document.querySelector('[data-screen="settings"]') as HTMLElement).click());
  await expect(page.locator('.settingsView__tab--active')).toBeVisible();
  const color = (selector: string) => page.locator(selector).first().evaluate((element) => getComputedStyle(element).color);
  const navActive = await page.locator('.sidebarItem__icon--active').evaluate((element) => getComputedStyle(element).color);
  const navPlain = await page.locator('[data-screen="search"] .sidebarItem__icon').evaluate((element) => getComputedStyle(element).color);
  expect(await color('.settingsView__tab--active')).toBe(navActive);
  expect(await color('.settingsView__tab:not(.settingsView__tab--active)')).toBe(navPlain);
  const active = page.locator('.settingsView__tab--active');
  expect(await active.evaluate((element) => { const style = getComputedStyle(element); return [style.backgroundColor, style.boxShadow, style.borderRadius]; })).toEqual(['rgba(0, 0, 0, 0)', 'none', '0px']);
  expect(await active.evaluate((element) => getComputedStyle(element, '::before').content)).toBe('""');
  expect(await page.locator('.settingsView__tab:not(.settingsView__tab--active)').first().evaluate((element) => getComputedStyle(element, '::before').content)).toBe('none');
  const strip = (await page.locator('.settingsView__tabs').boundingBox())!;
  const mark = await active.evaluate((element) => { const box = element.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; });
  expect(mark.bottom).toBeLessThanOrEqual(strip.y + strip.height + 1);
  await expect(page.locator('.settingsView__tabLabel').first()).toBeVisible();
  const pressed = page.locator('.settingsView__tab').nth(3);
  const tab = (await pressed.boundingBox())!;
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
  await page.mouse.down();
  expect(await pressed.evaluate((element) => getComputedStyle(element).color)).toBe(navActive);
  await page.mouse.move(5, 500);
  await page.mouse.up();
});

test('pressing an icon of the menu bar colours and shrinks it for a moment', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const icon = page.locator('[data-screen="events"] .sidebarItem__icon');
  const before = await icon.evaluate((element) => getComputedStyle(element).color);
  const cell = (await page.locator('[data-screen="events"]').boundingBox())!;
  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
  await page.mouse.down();
  await expect.poll(() => icon.evaluate((element) => getComputedStyle(element).transform)).not.toBe('none');
  expect(await icon.evaluate((element) => getComputedStyle(element).color)).not.toBe(before);
  await page.mouse.move(5, 500);
  await page.mouse.up();
});

test.describe('menu position on small screens', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu is at the top by default and the Menu Position setting moves it and the Settings tabs to the bottom', async ({ page }) => {
    await start(page, {});
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    expect((await page.locator('.sidebar').boundingBox())!.y).toBe(0);
    await page.evaluate(() => (document.querySelector('[data-screen="settings"]') as HTMLElement).click());
    const tabsAtTop = (await page.locator('.settingsView__tabs').boundingBox())!;
    expect(tabsAtTop.y).toBeGreaterThanOrEqual(56);
    const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Menu Position$/ }) });
    await row.scrollIntoViewIfNeeded();
    await row.getByText('Bottom', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-menu-position', 'bottom');
    const bar = (await page.locator('.sidebar').boundingBox())!;
    expect([bar.x, bar.y + bar.height, bar.width, bar.height]).toEqual([0, 844, 390, 56]);
    const tabs = (await page.locator('.settingsView__tabs').boundingBox())!;
    const content = (await page.locator('.settingsView__content').boundingBox())!;
    expect(tabs.y).toBeGreaterThan(content.y);
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(bar.y + 1);
    expect(content.y).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => (document.querySelector('[data-screen="recent"]') as HTMLElement).click());
    await expect(page.locator('.carouselTitle').first()).toBeVisible();
    const lowest = await page.evaluate(() => document.querySelector('.homeRows')!.getBoundingClientRect().bottom);
    expect(lowest).toBeLessThanOrEqual(bar.y + 1);
    expect(await page.evaluate(() => document.querySelector('.carouselTitle')!.getBoundingClientRect().top)).toBeLessThan(60);
  });

  test('each screen fits between the edge and a menu at the bottom', async ({ page }) => {
    await start(page, { menuPosition: 'bottom' });
    await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
    const bar = (await page.locator('.sidebar').boundingBox())!;
    for (const id of ['recent', 'search', 'popular', 'events', 'watchlist', 'settings']) {
      await page.evaluate((target) => (document.querySelector(`[data-screen="${target}"]`) as HTMLElement).click(), id);
      await page.waitForTimeout(300);
      const extent = await page.evaluate(() => { const boxes = [...document.querySelectorAll('.popularView, .eventsListView, .watchlistView, .settingsView, .searchContainer, .homeRows')].map((element) => element.getBoundingClientRect()); return { top: Math.min(...boxes.map((box) => box.top)), bottom: Math.max(...boxes.map((box) => box.bottom)) }; });
      const mark = await page.evaluate((target) => { const style = getComputedStyle(document.querySelector(`[data-screen="${target}"]`)!, '::before'); return { width: parseFloat(style.width), top: style.top }; }, id);
      expect(mark.width, `${id} mark`).toBeGreaterThanOrEqual(20);
      expect(mark.top, `${id} mark`).toBe('0px');
      expect(extent.top, id).toBeGreaterThanOrEqual(-1);
      expect(extent.bottom, id).toBeLessThanOrEqual(bar.y + 1);
    }
  });
});

test('clicking a conference name on the home page opens that conference and Escape returns', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await page.locator('.carouselTitle--link').first().click();
  await expect(page.locator('.conferenceView__title')).toBeVisible();
  await expect(page.locator('.conferenceView__gridItem').first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await expect(page.locator('.carouselTitle').first()).toBeVisible();
  await expect(page.locator('.conferenceView__title')).toHaveCount(0);
});

test('tapping a conference name on a phone opens that conference too', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).hostname === '127.0.0.1') { await route.continue(); return; }
    const response = fixture(request.url(), request.postData() || undefined);
    if (!response) throw Error(`Unexpected external request: ${request.url()}`);
    await route.fulfill({ ...response, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await start(page, {});
  const title = page.locator('.carouselTitle--link').first();
  await expect(title).toBeVisible();
  const box = (await title.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.conferenceView__title')).toBeVisible();
  await context.close();
});

test('the progress handle lights up under the pointer, is moved by a transform and keeps one size', async ({ page }) => {
  await start(page, { accentColor: '#F44336' });
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  await expect(page.locator('video.player-video')).toBeVisible();
  const handle = () => page.locator('.playerProgress__thumb').evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { background: style.backgroundColor, transform: style.transform, width: style.width, left: getComputedStyle(element).left, carrier: getComputedStyle(element).transform };
  });
  await page.mouse.move(600, 300);
  expect((await handle()).background).toBe('rgb(255, 255, 255)');
  expect((await handle()).left).toBe('0px');
  const bar = (await page.locator('.playerProgress__barWrapper').boundingBox())!;
  await page.mouse.move(bar.x + 3, bar.y + bar.height / 2);
  await expect.poll(async () => (await handle()).background).toBe('rgb(244, 67, 54)');
  await expect.poll(async () => (await handle()).transform).toMatch(/^matrix\(1\.2/);
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  expect((await handle()).background).toBe('rgb(244, 67, 54)');
  await page.mouse.move(600, 300);
  await expect.poll(async () => (await handle()).background).toBe('rgb(255, 255, 255)');
  const before = (await handle()).width;
  await page.evaluate(() => {
    const video = document.querySelector('video.player-video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 123.4 });
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 3600 });
    video.dispatchEvent(new Event('timeupdate'));
  });
  await expect.poll(async () => (await handle()).carrier).toMatch(/^matrix\(1, 0, 0, 1, [1-9]/);
  expect((await handle()).width).toBe(before);
});

test('the progress handle can be dragged to another point and the video seeks once when it is dropped', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  await expect(page.locator('video.player-video')).toBeVisible();
  await page.evaluate(() => {
    const video = document.querySelector('video.player-video') as HTMLVideoElement;
    const seeks: number[] = [];
    (window as unknown as { seeks: number[] }).seeks = seeks;
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 0, set: (value: number) => { seeks.push(value); } });
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 3600 });
    video.dispatchEvent(new Event('durationchange'));
  });
  const seeks = () => page.evaluate(() => (window as unknown as { seeks: number[] }).seeks);
  const carrier = () => page.locator('.playerProgress__thumb').evaluate((element) => getComputedStyle(element).transform);
  const clock = () => page.locator('.playerProgress__time').first().innerText();
  const bar = (await page.locator('.playerProgress__barWrapper').boundingBox())!;
  const middle = bar.y + bar.height / 2;
  await page.mouse.move(bar.x + bar.width * 0.2, middle);
  await page.mouse.down();
  await expect.poll(clock).toMatch(/^(11:5\d|12:0\d)$/);
  await page.mouse.move(bar.x + bar.width * 0.6, middle - 150, { steps: 6 });
  await expect.poll(clock).toMatch(/^(35:5\d|36:0\d)$/);
  expect(await carrier()).toMatch(/^matrix\(1, 0, 0, 1, [1-9]/);
  expect(await seeks()).toEqual([]);
  await page.mouse.up();
  await expect.poll(seeks).toHaveLength(1);
  expect(Math.abs((await seeks())[0] - 2160)).toBeLessThan(10);
  await page.mouse.move(bar.x + bar.width * 0.9, middle);
  expect(await seeks()).toHaveLength(1);
  await page.mouse.click(bar.x + bar.width * 0.5, middle);
  await expect.poll(seeks).toHaveLength(2);
  expect(Math.abs((await seeks())[1] - 1800)).toBeLessThan(10);
});

test('the watched track of a tile has the background and the glass of the side navigation', async ({ page }) => {
  const talk = { guid: 'saved', slug: 'saved', title: 'Saved talk', duration: 600, persons: ['Speaker'], images: { thumbUrl: 'https://static.media.ccc.de/fixture.svg' }, videos: [], subtitles: [], viewCount: 1 };
  const items = [0, 1].map((i) => ({ event: { ...talk, guid: `saved${i}`, slug: `saved${i}`, title: `Saved talk ${i}` }, conferenceTitle: 'Saved', positionSeconds: 150 * (i + 1), durationSeconds: 600, updatedAt: Date.now() - i }));
  const styles = () => page.evaluate(() => {
    const read = (element: Element, pseudo?: string) => { const style = getComputedStyle(element, pseudo); return { color: style.backgroundColor, image: style.backgroundImage, blur: style.getPropertyValue('backdrop-filter') || style.getPropertyValue('-webkit-backdrop-filter') }; };
    const tracks = document.querySelectorAll('.embla__slide__progress');
    return { nav: read(document.querySelector('.sidebar')!), active: read(tracks[0], '::before'), idle: read(tracks[1], '::before'), opacity: getComputedStyle(tracks[1], '::before').opacity };
  });
  await start(page, { railStyle: 'panel', continue_watching: { version: 1, items } });
  await expect(page.locator('.embla__slide__progress')).toHaveCount(2);
  let found = await styles();
  expect(found.idle.color).toBe(found.nav.color);
  expect(found.idle.color).not.toBe('rgb(0, 0, 0)');
  expect(Number(found.opacity)).toBeLessThanOrEqual(0.5);
  expect(found.idle.blur === 'none' || found.idle.blur === '').toBe(true);
  await start(page, { railStyle: 'glass', glassSheen: 'gloss', glassTransparency: 'medium', continue_watching: { version: 1, items } });
  found = await styles();
  expect(found.idle.blur).toContain('blur(18px)');
  expect(found.idle.blur).toBe(found.nav.blur);
  expect(found.idle.image).toContain('linear-gradient');
  expect(found.idle.image).not.toContain('radial-gradient');
  expect(found.active.blur).toContain('blur(18px)');
  expect(found.active.color).toMatch(/^rgba\(0, 0, 0, 0\.38\)$/);
  await start(page, { railStyle: 'transparent', continue_watching: { version: 1, items } });
  found = await styles();
  expect(found.idle.color).toBe('rgb(0, 0, 0)');
  expect(found.idle.image).toContain('radial-gradient');
});

test('the player hides the cursor with the controls when idle and Escape hides them before it leaves the video', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  const video = page.locator('video.player-video');
  await expect(video).toBeVisible();
  const wrapper = page.locator('.player-wrapper');
  const cursor = () => wrapper.evaluate((element) => getComputedStyle(element).cursor);
  await page.mouse.move(600, 400);
  await expect(wrapper).toHaveClass(/controls-visible/);
  expect(await cursor()).toBe('auto');
  await expect(wrapper).toHaveClass(/controls-hidden/, { timeout: 6000 });
  expect(await cursor()).toBe('none');
  await page.mouse.move(640, 420);
  await expect(wrapper).toHaveClass(/controls-visible/);
  expect(await cursor()).toBe('auto');
  await page.keyboard.press('Escape');
  await expect(wrapper).toHaveClass(/controls-hidden/);
  expect(await cursor()).toBe('none');
  await expect(video).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(video).toHaveCount(0);
});

test('the player back button sits at the top left with the title next to it and leaves the video with the remote', async ({ page }) => {
  await start(page, { osdBackButton: 'on' });
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await page.getByRole('textbox').fill('fixture');
  await page.locator('.searchResults .listItem').click();
  const back = page.getByRole('button', { name: 'Back', exact: true });
  await expect(back).toBeVisible();
  const box = (await back.boundingBox())!;
  expect(box.x).toBeCloseTo(0.04 * 1920, 0);
  expect(box.y).toBeGreaterThanOrEqual(0.022 * 1920 - 1);
  expect(box.y).toBeLessThan(0.022 * 1920 + 12);
  const title = (await page.locator('.playerUI__title').boundingBox())!;
  expect(title.x).toBeGreaterThanOrEqual(box.x + box.width);
  expect(Math.abs(title.y + title.height / 2 - (box.y + box.height / 2))).toBeLessThan(1);
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await expect(back).toHaveClass(/playerUI__button--focused/);
  await page.keyboard.press('Enter');
  await expect(page.locator('video.player-video')).toHaveCount(0);
});

test('the framed indicators are wide, leave a margin only on the left, and keep the icon in the middle of the frame', async ({ page }) => {
  const measure = async (indicator: string) => {
    await start(page, { navIndicator: indicator });
    return page.evaluate(() => {
      const item = document.querySelector('.sidebarItem--selected')!.getBoundingClientRect();
      const icon = document.querySelector('.sidebarItem--selected .sidebarItem__icon svg')!.getBoundingClientRect();
      return { left: item.left, right: item.right, iconCenter: icon.left + icon.width / 2 };
    });
  };
  const line = await measure('line');
  expect(line.left).toBe(0);
  for (const indicator of ['border', 'contrast']) {
    const framed = await measure(indicator);
    expect(framed.left, indicator).toBe(10);
    expect(framed.right, indicator).toBe(86);
    expect(framed.iconCenter, indicator).toBeCloseTo((framed.left + framed.right) / 2, 1);
  }
});

test('the line indicator makes way for the highlight in the open side menu and returns when the highlight moves on', async ({ page }) => {
  await start(page, { navIndicator: 'line' });
  const marker = () => page.evaluate(() => {
    const item = document.querySelector('.sidebarItem--selected')!;
    const bar = getComputedStyle(item, '::before');
    return { content: bar.content, left: bar.left, highlighted: item.classList.contains('sidebarItem--highlighted') };
  });
  expect(await marker()).toEqual({ content: '""', left: '14px', highlighted: false });
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.sidebarItem--highlighted.sidebarItem--selected')).toHaveCount(1);
  expect(await marker()).toEqual({ content: 'none', left: 'auto', highlighted: true });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.sidebarItem--highlighted.sidebarItem--selected')).toHaveCount(0);
  expect((await marker()).content).toBe('""');
});

test('the CCCBib logo can be the Home button and then replaces the home icon', async ({ page }) => {
  await start(page, { logoButton: 'home' });
  await expect(page.locator('.sidebarItem--brand')).toHaveCount(1);
  await expect(page.locator('.sidebarItem').filter({ hasText: 'Home' })).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).click();
  await expect(page.locator('.searchContainer')).toBeVisible();
  await page.locator('.sidebarItem--brand').click();
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await page.locator('.sidebarItem--bottom').click();
  await expect(page.locator('.settingsView')).toBeVisible();
  await page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Logo Button$/ }) }).getByText('Settings', { exact: true }).click();
  await expect(page.locator('.sidebarItem--bottom')).toHaveCount(0);
  await expect(page.locator('.sidebarItem').filter({ hasText: 'Home' })).toHaveCount(1);
});

test('the CCCBib logo used as the Settings entry is never marked by the side menu indicator', async ({ page }) => {
  await start(page, { logoButton: 'settings', navIndicator: 'contrast' });
  const brand = page.locator('.sidebarItem--brand');
  await brand.click();
  await expect(page.locator('.settingsView')).toBeVisible();
  await expect(brand).toHaveClass(/sidebarItem--selected/);
  const marker = (selector: string) => page.evaluate((target) => getComputedStyle(document.querySelector(target)!, '::before').content, selector);
  const choose = (name: string) => page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Indicator$/ }) }).getByText(name, { exact: true }).click();
  for (const name of ['Contrast', 'Border', 'Line']) {
    await choose(name);
    await expect(brand).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(brand).toHaveCSS('box-shadow', 'none');
    expect(await marker('.sidebarItem--brand'), name).toBe('none');
  }
  const home = page.locator('.sidebarItem').filter({ hasText: 'Home' });
  await home.click();
  await expect(home).toHaveClass(/sidebarItem--selected/);
  expect(await marker('.sidebarItem--selected')).toBe('""');
  await expect(brand).not.toHaveClass(/sidebarItem--selected/);
});

test('the mouse hovers and clicks the tiles of every home row', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const tiles = page.locator('.embla .embla__slide');
  const left = () => tiles.nth(0).evaluate((element) => element.getBoundingClientRect().left);
  const before = await left();
  await tiles.nth(2).hover();
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('More talk 0.0');
  await page.waitForTimeout(500);
  const box = (await tiles.nth(2).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4);
  await page.waitForTimeout(300);
  expect(await left()).toBe(before);
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('More talk 0.0');
  await tiles.nth(0).hover();
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Fixture talk');
  const second = page.locator('.embla').nth(1).locator('.embla__slide');
  await second.nth(1).hover();
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 1');
  await expect(page.locator('.embla__slide.active')).toHaveCount(1);
  await expect(page.locator('.preview-title')).toHaveText('Other talk 1');
  await second.nth(1).click();
  await expect(page.locator('video.player-video')).toBeVisible();
});

test('the wheel scrolls the home rows like a page and the selection follows the pointer, not the wheel', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const rowsView = page.locator('.homeRows');
  const scrollTop = () => rowsView.evaluate((element) => element.scrollTop);
  expect(await scrollTop()).toBe(0);
  const tile = page.locator('.embla').nth(0).locator('.embla__slide').nth(1);
  await tile.hover();
  await expect(page.locator('.preview-title')).toHaveText('Other talk 0');
  await page.mouse.wheel(0, 120);
  await expect.poll(scrollTop).toBeGreaterThan(60);
  expect(await scrollTop()).toBeLessThan(400);
  await page.mouse.wheel(0, 120);
  await expect.poll(scrollTop).toBeGreaterThan(150);
  const first = await scrollTop();
  const above = await page.locator('.embla').nth(0).evaluate((element) => element.getBoundingClientRect().top - document.querySelector('.homeRows')!.getBoundingClientRect().top);
  expect(above).toBeLessThan(0);
  await page.mouse.move(900, 80);
  await page.mouse.wheel(0, 120);
  await expect.poll(scrollTop).toBeGreaterThan(first + 60);
  const bar = page.locator('.homeScroll');
  const opacity = () => bar.evaluate((element) => getComputedStyle(element).opacity);
  await page.mouse.wheel(0, 100);
  await expect.poll(opacity).toBe('1');
  const barBox = (await bar.boundingBox())!;
  expect(barBox.y).toBe(0);
  expect(barBox.x + barBox.width).toBe(1920);
  expect(barBox.height).toBe(1080);
  const thumbBox = (await page.locator('.homeScroll__thumb').boundingBox())!;
  expect(thumbBox.y).toBeGreaterThanOrEqual(0);
  expect(thumbBox.height).toBeGreaterThan(8);
  expect(await rowsView.evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar').width)).toBe('0px');
  await expect.poll(opacity, { timeout: 4000 }).toBe('0');
  await page.mouse.wheel(0, -2000);
  await expect.poll(scrollTop).toBe(0);
  await page.mouse.move(900, 30);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 10000);
  await expect.poll(scrollTop).toBeGreaterThan(300);
  await expect(page.locator('.carouselTitle').last()).toBeVisible();
});

test('a row keeps its slides in place when the pointer moves on to a tile of the row below', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const rows = page.locator('.embla');
  const tile = rows.nth(0).locator('.embla__slide').nth(2);
  const left = () => tile.evaluate((element) => Math.round(element.getBoundingClientRect().left));
  await tile.hover();
  await expect(tile).toHaveClass(/active/);
  const before = await left();
  const below = rows.nth(1).locator('.embla__slide').nth(1);
  await below.hover();
  await expect(below).toHaveClass(/active/);
  await expect(tile).not.toHaveClass(/active/);
  await page.waitForTimeout(600);
  expect(await left()).toBe(before);
  await rows.nth(0).locator('.embla__slide').nth(1).hover();
  await below.hover();
  await page.waitForTimeout(600);
  expect(await left()).toBe(before);
});

test('the settings tabs wrap around from the last tab to the first with the keys and back', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const active = page.locator('.settingsView__tab--active');
  await page.locator('.settingsView__tab').first().click();
  await page.keyboard.press('ArrowUp');
  await expect(active).toContainText('Data & About');
  await page.keyboard.press('ArrowDown');
  await expect(active).toContainText('Appearance');
});

test('the tab list and the page of Settings are compositor layers of their own and the page still scrolls', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const client = await page.context().newCDPSession(page);
  const layered = new Set<number>();
  client.on('LayerTree.layerTreeDidChange', ({ layers }) => (layers || []).forEach((layer) => { if (layer.backendNodeId) layered.add(layer.backendNodeId); }));
  await client.send('LayerTree.enable');
  const { root } = await client.send('DOM.getDocument');
  for (const selector of ['.settingsView__tabs', '.settingsView__content']) {
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { node } = await client.send('DOM.describeNode', { nodeId });
    await expect.poll(() => layered.has(node.backendNodeId), { message: selector }).toBe(true);
  }
  const content = page.locator('.settingsView__content');
  await page.mouse.move(1000, 500);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('the cat of the About page moves while nothing is pressed and rests on every input', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await page.locator('.settingsView__tab').filter({ hasText: 'Data & About' }).click();
  await expect(page.locator('.settingsView__cat .voctocat div').first()).toBeAttached();
  const states = () => page.evaluate(() => document.querySelector('.settingsView__cat')!.getAnimations({ subtree: true }).map((animation) => animation.playState));
  expect(await states()).not.toContain('running');
  await expect.poll(states, { timeout: 4000 }).toContain('running');
  await page.keyboard.press('Shift');
  expect(await states()).not.toContain('running');
  await expect.poll(states, { timeout: 4000 }).toContain('running');
});

test('the wheel scrolls the events list like a page and hovering a half visible item does not scroll it', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Events' }).click();
  const list = page.locator('.eventsListView__list');
  await expect(list.locator('.listItem').first()).toBeVisible();
  const scrollTop = () => list.evaluate((element) => element.scrollTop);
  const metrics = () => list.evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
  const { scroll, client } = await metrics();
  expect(scroll).toBeGreaterThan(client);
  const box = (await list.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8);
  await page.waitForTimeout(500);
  expect(await scrollTop()).toBe(0);
  await expect(page.locator('.listItem--selected')).toHaveCount(1);
  await page.mouse.wheel(0, 150);
  await expect.poll(scrollTop).toBeGreaterThan(80);
  await page.waitForTimeout(400);
  await expect(page.locator('.listItem--selected')).toHaveCount(1);
  const selected = await page.locator('.listItem--selected').evaluate((element, container) => {
    const item = element.getBoundingClientRect(); const area = (container as HTMLElement).getBoundingClientRect();
    return item.top <= area.bottom && item.bottom >= area.top;
  }, await list.elementHandle());
  expect(selected).toBe(true);
});

test('the mouse opens the side menu by pointing at it, scrolls it with the wheel, and leaves it by pointing at the screen', async ({ page }) => {
  await start(page, {});
  const menu = page.locator('.sidebar');
  await page.locator('.sidebarItem').filter({ hasText: 'Search' }).hover();
  await expect(menu).toHaveClass(/sidebar--focused/);
  await expect(page.locator('.sidebarItem--highlighted')).toContainText('Search');
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 100);
  await expect(page.locator('.sidebarItem--highlighted')).toContainText('Popular');
  await page.locator('.sidebarItem').filter({ hasText: 'Watchlist' }).hover();
  await expect(page.locator('.sidebarItem--highlighted')).toContainText('Watchlist');
  await page.mouse.move(1200, 600);
  await expect(menu).not.toHaveClass(/sidebar--focused/);
  await expect(page.locator('.sidebarItem--highlighted')).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Popular' }).click();
  await expect(page.locator('.popularView')).toBeVisible();
});

test('the wheel scrolls the settings page without moving through its rows but steps through the tabs', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const content = page.locator('.settingsView__content');
  const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Theme$/ }) });
  await row.locator('.settingsView__select').hover();
  await expect(row).toHaveClass(/settingsView__row--focused/);
  const control = (await row.locator('.settingsView__select').boundingBox())!;
  const cursor = { x: control.x + control.width / 2, y: control.y + control.height / 2 };
  expect(await content.evaluate((element) => element.scrollTop)).toBe(0);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(row).not.toHaveClass(/settingsView__row--focused/);
  const underCursor = (position: { x: number; y: number }) => page.evaluate(({ x, y }) => {
    const hovered = document.elementFromPoint(x, y)?.closest('.settingsView__row');
    return Boolean(hovered) && hovered === document.querySelector('.settingsView__row--focused');
  }, position);
  expect(await underCursor(cursor)).toBe(true);
  const settled = await content.evaluate((element) => element.scrollTop);
  await page.waitForTimeout(600);
  expect(await content.evaluate((element) => element.scrollTop)).toBe(settled);
  const tabs = page.locator('.settingsView__tab');
  await tabs.nth(0).hover();
  await expect(tabs.nth(0)).toHaveClass(/settingsView__tab--focused/);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 100);
  await expect(tabs.nth(1)).toHaveClass(/settingsView__tab--active/);
});

test('the scrollbar thumbs scale with the border width but stay thinner than their strip', async ({ page }) => {
  await start(page, { borderWidth: 3 });
  const sizes = () => page.evaluate(() => ({
    thumb: getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-width'),
    strip: getComputedStyle(document.documentElement, '::-webkit-scrollbar').width,
  }));
  expect(await sizes()).toEqual({ thumb: '2px', strip: '14px' });
  expect(await page.locator('.homeScroll').evaluate((element) => getComputedStyle(element).width)).toBe('14px');
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  await page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Border Width$/ }) }).locator('.settingsView__select').click();
  await page.locator('.picker__item').filter({ hasText: '6px' }).click();
  expect((await sizes()).thumb).toBe('3px');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.settingsView__content')!, '::-webkit-scrollbar').width)).toBe('14px');
});

test('the scrollbar setting makes every scrollbar large or hides it', async ({ page }) => {
  await start(page, {});
  const homeBar = () => page.locator('.homeScroll').evaluate((element) => getComputedStyle(element).width);
  expect(await homeBar()).toBe('14px');
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Scrollbar$/ }) });
  const strips = () => page.evaluate(() => ({
    list: getComputedStyle(document.querySelector('.settingsView__content')!, '::-webkit-scrollbar').width,
    thumb: getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-width'),
  }));
  expect(await strips()).toEqual({ list: '14px', thumb: '3px' });
  await row.getByText('Large', { exact: true }).click();
  expect(await strips()).toEqual({ list: '28px', thumb: '12px' });
  await page.mouse.move(40, 500);
  expect(await page.locator('.settingsView__content').evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar-thumb').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await row.getByText('Hidden', { exact: true }).click();
  expect(await strips()).toEqual({ list: '0px', thumb: '0px' });
  expect(await page.evaluate(() => localStorage.getItem('scrollbarSize'))).toBe('"hidden"');
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0);
  expect(await homeBar()).toBe('0px');
});

test('the home bar can be grabbed and dragged with the pointer', async ({ page }) => {
  await start(page, {});
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  const rowsView = page.locator('.homeRows');
  const scrollTop = () => rowsView.evaluate((element) => element.scrollTop);
  const max = await rowsView.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(max).toBeGreaterThan(300);
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 60);
  const thumb = page.locator('.homeScroll__thumb');
  await expect.poll(async () => (await thumb.boundingBox())!.height).toBeGreaterThan(8);
  const box = (await thumb.boundingBox())!;
  const x = 1920 - 7;
  await page.mouse.move(x, box.y + box.height / 2);
  await expect.poll(() => page.locator('.homeScroll').evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await page.mouse.down();
  await page.mouse.move(x, 1070, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => max - (await scrollTop())).toBeLessThan(3);
  await page.mouse.move(x, 600);
  await page.mouse.down();
  await page.mouse.move(x, 5, { steps: 10 });
  await page.mouse.up();
  await expect.poll(scrollTop).toBe(0);
});

test('scrollbars only show while the page scrolls', async ({ page }) => {
  await start(page, { accentColor: '#F44336' });
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const thumb = () => page.locator('.settingsView__content').evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar-thumb').backgroundColor);
  expect(await thumb()).toBe('rgba(0, 0, 0, 0)');
  await page.mouse.move(40, 500);
  await page.locator('.settingsView__content').evaluate((element) => { element.scrollTop = 300; });
  await expect.poll(thumb).toBe('rgb(244, 67, 54)');
  await expect.poll(thumb, { timeout: 4000 }).toBe('rgba(0, 0, 0, 0)');
});

test('returning from the tabs and the side menu to the settings content keeps the row and the scroll position', async ({ page }) => {
  await start(page, {});
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('.settingsView')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowDown');
  const content = page.locator('.settingsView__content');
  const focusedRow = page.locator('.settingsView__row--focused .settingsView__rowName');
  const row = await focusedRow.textContent();
  await page.waitForTimeout(900);
  const scrolled = await content.evaluate((element) => element.scrollTop);
  expect(scrolled).toBeGreaterThan(0);
  for (let step = 0; step < 3 && (await page.locator('.settingsView__tab--focused').count()) === 0; step++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.settingsView__tab--focused')).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.sidebar')).toHaveClass(/sidebar--focused/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar--focused/);
  await page.keyboard.press('ArrowRight');
  await expect(focusedRow).toHaveText(row!);
  await page.waitForTimeout(900);
  expect(await content.evaluate((element) => element.scrollTop)).toBe(scrolled);
});

test('a wheel notch over the collapsed side menu expands it before it steps through the items', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Popular' }).click();
  await expect(page.locator('.popularView')).toBeVisible();
  const menu = page.locator('.sidebar');
  await expect(menu).not.toHaveClass(/sidebar--focused/);
  await page.mouse.wheel(0, 100);
  await expect(menu).toHaveClass(/sidebar--focused/);
  await expect(page.locator('.sidebarItem--highlighted')).toContainText('Popular');
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 100);
  await expect(page.locator('.sidebarItem--highlighted')).toContainText('Events');
});

test('the button style is picked in a popup with previews', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Button Style$/ }) });
  await expect(row.locator('.settingsView__segment')).toHaveCount(0);
  await row.locator('.settingsView__select').click();
  await expect(page.locator('.picker__item .settingsView__btnPreview')).toHaveCount(8);
  await page.locator('.picker__item').filter({ hasText: 'Black & White' }).click();
  await expect(page.locator('.picker')).toHaveCount(0);
  await expect(row.locator('.settingsView__select')).toContainText('Black & White');
  expect(await page.evaluate(() => localStorage.getItem('buttonStyle'))).toBe('"black-white"');
});

test('the mouse focuses settings rows and options and the wheel scrolls the font picker with the highlight following the pointer', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  const row = (name: string) => page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: new RegExp(`^${name}$`) }) });
  await row('Theme').locator('.settingsView__select').hover();
  await expect(row('Theme')).toHaveClass(/settingsView__row--focused/);
  await expect(row('Theme').locator('.settingsView__control--focused')).toContainText('Black');
  await row('Indicator').getByText('Border', { exact: true }).hover();
  await expect(row('Indicator')).toHaveClass(/settingsView__row--focused/);
  await expect(row('Indicator').locator('.settingsView__control--focused')).toHaveText('Border');
  await row('Font').locator('.settingsView__select').click();
  const items = page.locator('.picker__item');
  const list = page.locator('.picker__list');
  await items.nth(2).hover();
  await expect(items.nth(2)).toHaveClass(/picker__item--selected/);
  const box = (await items.nth(2).boundingBox())!;
  const far = (await items.nth(8).boundingBox())!;
  const distance = Math.round(far.y + far.height / 2 - (box.y + box.height / 2));
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, distance);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(distance - 3);
  await expect(items.nth(8)).toHaveClass(/picker__item--selected/);
  await page.locator('.picker__item--selected').click();
  await expect(page.locator('.picker')).toHaveCount(0);
});

test('stepping through a popup list with the keys keeps the next item in view and the end of the list shows its last item', async ({ page }) => {
  await start(page, {});
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  const row = page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Loading Animation$/ }) });
  await row.locator('.settingsView__select').click();
  const items = page.locator('.picker__item');
  const count = await items.count();
  const list = (await page.locator('.picker__list').boundingBox())!;
  const bounds = async (index: number) => (await items.nth(index).boundingBox())!;
  await page.mouse.move(list.x + list.width / 2, list.y + 20);
  await page.waitForTimeout(300);
  for (let step = 0; step < count + 2; step++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(60);
    const selected = await items.evaluateAll((all) => all.findIndex((item) => item.classList.contains('picker__item--selected')));
    const current = await bounds(selected);
    expect(current.y).toBeGreaterThanOrEqual(list.y - 1);
    expect(current.y + current.height).toBeLessThanOrEqual(list.y + list.height + 1);
    if (selected > 3 && selected < count - 2) {
      const next = await bounds(selected + 1);
      expect(next.y + next.height).toBeLessThanOrEqual(list.y + list.height + 1);
    }
  }
  const last = await bounds(count - 1);
  expect(last.y + last.height).toBeLessThanOrEqual(list.y + list.height + 1);
  expect(await page.locator('.picker__list').evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar-thumb').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});

test('opening and closing the side menu with the keys never scrolls it sideways, so its icons do not jump', async ({ page }) => {
  await start(page, { navIndicator: 'border' });
  const state = () => page.evaluate(() => { const bar = document.querySelector('.sidebar') as HTMLElement; return { left: bar.scrollLeft, over: bar.scrollWidth - bar.clientWidth }; });
  expect((await state()).over).toBe(0);
  await page.evaluate(() => {
    const bar = document.querySelector('.sidebar') as HTMLElement;
    const seen = { max: 0 };
    (window as unknown as { seen: typeof seen }).seen = seen;
    const tick = () => { seen.max = Math.max(seen.max, bar.scrollLeft); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.sidebar--focused')).toHaveCount(1);
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.sidebar--focused')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { seen: { max: number } }).seen.max)).toBe(0);
  expect(await state()).toEqual({ left: 0, over: 0 });
});

test('the normal text and icon sizes are larger than the plain layout and sizes saved before keep their look', async ({ page }) => {
  const scales = () => page.evaluate(() => ({ text: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(), icon: getComputedStyle(document.documentElement).getPropertyValue('--icon-scale').trim() }));
  await start(page, {});
  expect(await scales()).toEqual({ text: '1.2', icon: '1.1' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('textScale', '1.2'); localStorage.setItem('iconScale', '1.1'); });
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0);
  expect(await scales()).toEqual({ text: '1.2', icon: '1.1' });
  expect(await page.evaluate(() => [localStorage.getItem('textScale'), localStorage.getItem('iconScale'), localStorage.getItem('scaleBase')])).toEqual(['1', '1', '1']);
});
