import { chromium, type Browser } from '@playwright/test';
import { test, expect } from './simulator.fixture';

const connect = chromium.connectOverCDP;

test.beforeAll(() => {
  chromium.connectOverCDP = new Proxy(connect, {
    async apply(target, receiver, args) {
      const browser: Browser = await Reflect.apply(target, receiver, args);
      const context = browser.contexts()[0];
      const route = context.route.bind(context);
      // Delay routing to reproduce the application target initialization race.
      context.route = async (...args: Parameters<typeof context.route>) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return route(...args);
      };
      return browser;
    },
  });
});

test.afterAll(() => { chromium.connectOverCDP = connect; });

test('startup: fixtures work when interception is delayed', async ({ simulator }) => {
  const page = simulator.page;
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await simulator.key('ArrowRight');
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 0');
});
