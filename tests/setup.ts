import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

HTMLElement.prototype.scrollIntoView = () => {};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('APP_VERSION', 'test');
  vi.stubGlobal('APP_ID', 'org.webosbrew.cccbib');
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
