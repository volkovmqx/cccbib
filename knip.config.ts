import { defineConfig } from 'knip/config';

export default defineConfig(({ production }) => ({
  entry: ['steiger.config.ts', 'tools/*.{js,cjs}', 'tests/browser/*.cjs', 'tests/webos/*.spec.ts'],
  project: ['src/**/*.{js,jsx,ts,tsx}!', 'tools/*.{js,cjs}', 'tests/**/*.{ts,tsx,cjs}', '*.{js,mjs,mts,ts}', '!src/**/*.test.{ts,tsx}!'],
  ignoreExportsUsedInFile: true,
  // Babel injects core-js imports into the production bundle.
  ignoreDependencies: ['core-js'],
  // The development start script uses webpack-cli from devDependencies.
  ignoreBinaries: production ? ['webpack'] : [],
}));
