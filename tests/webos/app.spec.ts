import { test, expect } from './simulator.fixture';

test('compatibility: CDP controls the production application', async ({ simulator }) => {
  const page = simulator.page;
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.carouselTitle').first()).toHaveText('Fixture conference 0');
  await simulator.key('ArrowRight');
  await expect(page.locator('.embla__slide.active .embla__slide__title')).toHaveText('Other talk 0');
});
