import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [{
    name: 'html-source',
    transform(source, id) {
      if (id.endsWith('.html')) return { code: `export default ${JSON.stringify(source)}`, map: null };
    },
  }],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      reporter: ['text', 'html', 'lcov', 'json-summary', 'json'],
      reportOnFailure: true,
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
