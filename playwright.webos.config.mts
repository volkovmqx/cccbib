import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/webos',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/webos',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'webos-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/webos-junit.xml' }],
  ],
});
