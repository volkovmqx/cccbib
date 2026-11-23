import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const root = process.cwd();
const html = readFileSync(join(root, 'src/index.html'), 'utf8');

test('the page names a voctocat favicon as a vector and a picture and both files ship with the app', () => {
  expect(html).toContain('<link rel="icon" type="image/svg+xml" href="./favicon.svg" />');
  expect(html).toContain('<link rel="icon" type="image/png" sizes="96x96" href="./favicon.png" />');
  expect(html).toContain('<link rel="apple-touch-icon" href="./favicon.png" />');
  const svg = readFileSync(join(root, 'assets/favicon.svg'), 'utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 26\.458318 26\.458333">/);
  expect(svg).toContain('fill="#aaf40d"');
  expect(svg).not.toMatch(/<script|class=|style=/);
  const png = readFileSync(join(root, 'assets/favicon.png'));
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(statSync(join(root, 'assets/favicon.png')).size).toBeLessThan(20000);
});

test('the page starts with the app name as its title', () => {
  expect(html).toContain('<title>CCCBib</title>');
});
