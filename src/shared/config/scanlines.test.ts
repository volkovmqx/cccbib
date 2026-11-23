import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { syncScanlines } from './scanlines';

let overlay: HTMLElement;
let band: HTMLElement;
const root = document.documentElement;
const advance = (ms: number) => vi.advanceTimersByTime(ms);
const line = () => parseFloat(/translateY\((-?[\d.]+)px\)/.exec(band.style.transform)![1]);

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="scanlines"><span class="scanBand"></span></div>';
  overlay = document.getElementById('scanlines')!;
  band = overlay.querySelector('.scanBand')!;
  vi.stubGlobal('innerHeight', 880);
});
afterEach(() => {
  syncScanlines('off');
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

test('the Pulse sends one line down the screen shortly after it is chosen, then every half minute, and the line only exists while it travels', () => {
  syncScanlines('pulse');
  expect(root).not.toHaveAttribute('data-scan-pulse');
  advance(1600);
  expect(root).toHaveAttribute('data-scan-pulse');
  expect(line()).toBeLessThan(-100);
  advance(4000);
  expect(line()).toBeGreaterThan(-120 + 0.4 * 1000);
  advance(4200);
  expect(root).not.toHaveAttribute('data-scan-pulse');
  advance(21000);
  expect(root).not.toHaveAttribute('data-scan-pulse');
  advance(1500);
  expect(root).toHaveAttribute('data-scan-pulse');
});

test('the Pulse keeps moving while keys are pressed and the pointer moves', () => {
  syncScanlines('pulse');
  advance(3000);
  const before = line();
  for (const name of ['keydown', 'mousemove', 'wheel']) window.dispatchEvent(new Event(name));
  advance(1000);
  expect(line()).toBeGreaterThan(before + 40);
});

test('nothing moves while the page is hidden or a talk plays and it goes on afterwards', () => {
  syncScanlines('pulse');
  advance(3000);
  const before = line();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  advance(2000);
  expect(line()).toBe(before);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const player = document.createElement('div');
  player.className = 'player-fullscreen-container';
  document.body.appendChild(player);
  advance(2000);
  expect(line()).toBe(before);
  player.remove();
  advance(1000);
  expect(line()).toBeGreaterThan(before);
});

test('the other filters start no timer, and people who asked for reduced motion or a page without the line get none either', () => {
  for (const code of ['off', 'lines', 'grille', 'trinitron', 'pixels', 'dots', 'tube']) {
    syncScanlines(code);
    expect(vi.getTimerCount(), code).toBe(0);
  }
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addListener() {}, removeListener() {} }));
  syncScanlines('pulse');
  expect(vi.getTimerCount()).toBe(0);
  syncScanlines('off');
  vi.unstubAllGlobals();
  vi.stubGlobal('innerHeight', 880);
  band.remove();
  syncScanlines('pulse');
  advance(500);
  expect(vi.getTimerCount()).toBe(0);
  syncScanlines('off');
  overlay.remove();
  syncScanlines('pulse');
  expect(vi.getTimerCount()).toBe(0);
});

test('choosing another filter stops the timer and takes the line and the attribute away', () => {
  syncScanlines('pulse');
  advance(3000);
  syncScanlines('lines');
  expect(vi.getTimerCount()).toBe(0);
  expect(root).not.toHaveAttribute('data-scan-pulse');
  expect(band.style.transform).toBe('');
  syncScanlines('pulse');
  syncScanlines('pulse');
  expect(vi.getTimerCount()).toBe(1);
});
