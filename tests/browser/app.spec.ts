import { test, expect } from '@playwright/test';
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
  await expect(page).toHaveTitle('Paused: Fixture talk');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('webOSRelaunch', { detail: { cmd: 'stop' } })));
  await expect(page.locator('video.player-video')).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await expect(page.locator('.settingsView')).toBeVisible();
  await page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Theme$/ }) }).getByText('Light', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
