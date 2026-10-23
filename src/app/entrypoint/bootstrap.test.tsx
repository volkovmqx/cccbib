import { act } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { seedQuery } from '@/shared/api';
import { loadHomeCache } from '@/entities/conference';
import { refreshMirrors } from '@/entities/talk';
import { initScrollbars, isWebOS } from '@/shared/lib';
import { backfillTalkDetails, buildReport } from '@/app/model';

vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render: vi.fn() })) }));
vi.mock('./App', () => ({ default: () => <div>App</div> }));
vi.mock('@/shared/config', () => ({ initAppearance: vi.fn() }));
const language = vi.hoisted(() => ({ ready: undefined as Promise<void> | undefined }));
vi.mock('@/shared/i18n', () => ({ initLanguage: vi.fn(), loadActiveLanguage: vi.fn(() => language.ready) }));
vi.mock('@/features/remote-control', () => ({ initRemote: vi.fn() }));
vi.mock('@/entities/talk', () => ({ refreshMirrors: vi.fn() }));
vi.mock('@/shared/lib', () => ({ initScrollbars: vi.fn(), isWebOS: vi.fn(() => false) }));
vi.mock('@/shared/api', () => ({ seedQuery: vi.fn() }));
vi.mock('@/entities/conference', () => ({ RECENT_KEY: 'recent', loadHomeCache: vi.fn() }));
vi.mock('@/app/model', () => ({ backfillTalkDetails: vi.fn(), buildReport: vi.fn() }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); document.body.innerHTML = '<div id="app"></div>'; });

test.each([false, true])('startup mounts React and seeds cached conferences when present: %s', async cached => {
  vi.mocked(loadHomeCache).mockReturnValue(cached ? [] : null);
  const listen = vi.spyOn(window, 'addEventListener');
  let loaded!: () => void;
  language.ready = new Promise<void>((resolve) => { loaded = resolve; });
  await import('../../index');
  expect(createRoot).not.toHaveBeenCalled();
  await act(async () => { loaded(); await language.ready; });
  expect(createRoot).toHaveBeenCalledWith(document.getElementById('app'));
  expect(window.cccbib.report).toBe(buildReport);
  expect(refreshMirrors).toHaveBeenCalledTimes(1);
  expect(initScrollbars).toHaveBeenCalledTimes(1);
  if (cached) expect(seedQuery).toHaveBeenCalledWith('recent', { conferencesRecent: [] });
  else expect(seedQuery).not.toHaveBeenCalled();
  const handler = listen.mock.calls.find(call => call[0] === 'error')![1] as (event: ErrorEvent) => void;
  handler(new ErrorEvent('error', { message: 'Other error' }));
  const overlay = document.createElement('div'); overlay.id = 'webpack-dev-server-client-overlay'; document.body.append(overlay);
  handler(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
  expect(overlay.style.display).toBe('none');
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(backfillTalkDetails).toHaveBeenCalledTimes(1);
  window.removeEventListener('error', handler as EventListener);
});

test.each([[true, true], [false, false]])('the page is marked as running on webOS only there: %s', async (tv, marked) => {
  vi.mocked(isWebOS).mockReturnValue(tv);
  vi.mocked(loadHomeCache).mockReturnValue(null);
  language.ready = Promise.resolve();
  document.documentElement.removeAttribute('data-webos');
  await import('../../index');
  expect(document.documentElement.hasAttribute('data-webos')).toBe(marked);
});
