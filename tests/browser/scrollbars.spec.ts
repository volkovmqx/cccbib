import { test, expect } from '@playwright/test';
const { fixture } = require('./fixtures.cjs') as { fixture: (url: string, body?: string) => { contentType: string; body: string | Buffer } | null };

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).hostname === '127.0.0.1') { await route.continue(); return; }
    const response = fixture(request.url(), request.postData() || undefined);
    if (!response) throw Error(`Unexpected external request: ${request.url()}`);
    await route.fulfill({ ...response, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
});

test('a popup list scrolls by dragging its scrollbar and by the wheel from anywhere over the popup', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('scaleBase', '1'); });
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.locator('.sidebarItem').filter({ hasText: 'Settings' }).click();
  await page.locator('.settingsView__row').filter({ has: page.locator('.settingsView__rowName', { hasText: /^Font$/ }) }).locator('.settingsView__select').click();
  const list = page.locator('.picker__list');
  const box = (await list.boundingBox())!;
  const barWidth = await list.evaluate((element) => (element as HTMLElement).offsetWidth - element.clientWidth);
  expect(barWidth).toBeGreaterThanOrEqual(14);
  const x = box.x + box.width - barWidth / 2;
  await page.mouse.move(x, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 10, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => list.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(3);
  await page.locator('.picker__title').hover();
  await page.mouse.wheel(0, -3000);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
});
