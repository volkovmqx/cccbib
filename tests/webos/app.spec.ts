import { test, expect, type Simulator } from './simulator.fixture';
import type { Page } from '@playwright/test';

async function ready(page: Page) {
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
}

async function menu(simulator: Simulator, label: string) {
  const page = simulator.page;
  await simulator.key('ArrowLeft');
  await expect(page.locator('.sidebar')).toHaveClass(/sidebar--focused/);
  for (let index = 0; index < 6; index++) {
    const highlighted = page.locator('.sidebarItem--highlighted .sidebarItem__label');
    if (await highlighted.textContent() === label) {
      await simulator.key('Enter');
      await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar--focused/);
      await expect(page.locator('.sidebarItem--selected .sidebarItem__label')).toHaveText(label);
      const selector = { Home: '.carouselTitle', Search: '.searchContainer', Popular: '.popularView',
        Events: '.eventsListView, .errorText', Watchlist: '.watchlistView', Settings: '.settingsView' }[label];
      if (!selector) throw new Error(`Unknown page: ${label}`);
      await expect(page.locator(selector).first()).toBeVisible();
      return;
    }
    await simulator.key('ArrowDown');
  }
  throw new Error(`The remote could not select ${label}.`);
}

async function play(simulator: Simulator) {
  await ready(simulator.page);
  await simulator.key('Enter');
  const video = simulator.page.locator('video.player-video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  return video;
}

async function exitPlayer(simulator: Simulator) {
  // The first Back hides the controls. The second Back closes the player.
  await simulator.key('ArrowUp');
  await simulator.key('Back');
  await expect(simulator.page.locator('video.player-video')).toBeVisible();
  await simulator.key('Back');
  await expect(simulator.page.locator('video.player-video')).toHaveCount(0);
}

test('startup: CDP controls the production application', async ({ simulator }) => {
  const page = simulator.page;
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await simulator.key('ArrowRight');
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('DELIBERATELY BROKEN ASSERTION');
});

test('navigation: arrows select, OK opens, and webOS Back returns', async ({ simulator }) => {
  await ready(simulator.page);
  await simulator.key('ArrowRight');
  await expect(simulator.page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 0');
  await simulator.key('ArrowLeft');
  await expect(simulator.page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Fixture talk');
  await play(simulator);
  await expect(simulator.page.locator('.playerUI__title')).toHaveText('Fixture talk');
  await exitPlayer(simulator);
  await ready(simulator.page);
});

test('pages: every page and conference details load', async ({ simulator }) => {
  const page = simulator.page;
  await ready(page);
  for (const [label, selector] of [['Search', '.searchContainer'], ['Popular', '.popularView'],
    ['Events', '.eventsListView']]) {
    await menu(simulator, label);
    await expect(page.locator(selector)).toBeVisible();
    if (label === 'Search') await simulator.dismissKeyboard();
  }
  await expect(page.locator('.eventsListView__item').first()).toContainText('Fixture conference 0');
  await simulator.key('Enter');
  await expect(page.locator('.conferenceView__title')).toHaveText('Fixture conference 0');
  await simulator.key('Back');
  await expect(page.locator('.eventsListView')).toBeVisible();
  await menu(simulator, 'Settings');
  await expect(page.locator('.settingsView')).toBeVisible();
  await menu(simulator, 'Watchlist');
  await expect(page.locator('.watchlistView')).toContainText('Your watchlist is empty');
  await menu(simulator, 'Home');
  await ready(page);
});

test('search: a query returns the expected talk and OK opens it', async ({ simulator }) => {
  const page = simulator.page;
  await ready(page);
  await menu(simulator, 'Search');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.insertText('fixture');
  await expect(page.locator('.searchResults .listItem')).toHaveCount(1);
  await expect(page.locator('.searchResults .listItem')).toContainText('Fixture talk');
  await simulator.dismissKeyboard();
  await simulator.key('ArrowDown');
  await simulator.key('Enter');
  await expect(page.locator('video.player-video')).toBeVisible();
  await expect(page.locator('.playerUI__title')).toHaveText('Fixture talk');
  await exitPlayer(simulator);
  await expect(page.locator('.searchContainer')).toBeVisible();
});

test('playback: video advances, pauses, resumes, seeks, and exits', async ({ simulator }) => {
  const video = await play(simulator);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoHeight)).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
    element.seekable.length ? element.seekable.end(0) : 0)).toBeGreaterThan(500);
  const before = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(before + 1);
  await simulator.key('ArrowUp');
  await simulator.key('Enter');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  const paused = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(await video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(paused, 1);
  await simulator.key('Enter');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(paused + 1);
  await simulator.key('ArrowDown');
  const position = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await simulator.key('ArrowRight');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(position + 8);
  await exitPlayer(simulator);
  await ready(simulator.page);
});

test('watchlist: a saved talk remains after a Simulator restart', async ({ simulator }) => {
  await play(simulator);
  await simulator.key('ArrowUp');
  for (let index = 0; index < 3; index++) await simulator.key('ArrowRight');
  await expect(simulator.page.locator('.playerUI__button--focused')).toHaveAttribute('aria-label', 'Add to Watchlist');
  await simulator.key('Enter');
  await expect(simulator.page.getByRole('button', { name: 'In Watchlist', exact: true })).toBeVisible();
  await exitPlayer(simulator);
  await simulator.restart();
  await ready(simulator.page);
  await menu(simulator, 'Watchlist');
  await expect(simulator.page.locator('.watchlistView__item')).toContainText('Fixture talk');
  await simulator.key('Enter');
  await expect(simulator.page.getByRole('button', { name: 'In Watchlist', exact: true })).toBeVisible();
});

test('settings: the selected theme remains after a Simulator restart', async ({ simulator }) => {
  await ready(simulator.page);
  await menu(simulator, 'Settings');
  await simulator.key('ArrowRight');
  await simulator.key('ArrowDown');
  await expect(simulator.page.locator('.settingsView__row--focused .settingsView__rowName')).toHaveText('Theme');
  await simulator.key('ArrowRight');
  await simulator.key('ArrowRight');
  await simulator.key('Enter');
  await expect(simulator.page.locator('html')).toHaveAttribute('data-theme', 'light');
  await simulator.restart();
  await ready(simulator.page);
  await expect(simulator.page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('progress: saved playback position remains after a Simulator restart', async ({ simulator }) => {
  const video = await play(simulator);
  await simulator.key('ArrowDown');
  for (let index = 0; index < 4; index++) {
    const position = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
    await simulator.key('ArrowRight');
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(position + 8);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.seeking)).toBe(false);
  }
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(30);
  await exitPlayer(simulator);
  const saved = await simulator.page.evaluate(() => JSON.parse(localStorage.getItem('continue_watching') || '{}').items[0].positionSeconds as number);
  expect(saved).toBeGreaterThan(30);
  await simulator.restart();
  await expect(simulator.page.locator('#boot')).toHaveCount(0);
  await expect(simulator.page.getByText('Continue Watching', { exact: true })).toBeVisible();
  await simulator.key('Enter');
  const resumed = simulator.page.locator('video.player-video');
  await expect(resumed).toBeVisible();
  await expect.poll(() => resumed.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThanOrEqual(saved - 1);
  await expect.poll(() => resumed.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(saved + 15);
});

test('request failure: a failed fixture request keeps navigation usable', async ({ simulator }) => {
  const page = simulator.page;
  await ready(page);
  simulator.failNextRequest('/public/conferences');
  await menu(simulator, 'Events');
  await expect(page.locator('.errorText')).toContainText('Failed to fetch conferences');
  expect(simulator.failedRequests).toBe(1);
  await menu(simulator, 'Search');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.insertText('fixture');
  await expect(page.locator('.searchResults .listItem')).toContainText('Fixture talk');
  await simulator.dismissKeyboard();
  await simulator.key('Back');
  await ready(page);
});
