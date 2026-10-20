import { act } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { seedQuery } from '@/shared/api';
import { loadHomeCache } from '@/entities/conference';
import { backfillTalkDetails, buildReport } from '@/app/model';

vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render: vi.fn() })) }));
vi.mock('./App', () => ({ default: () => <div>App</div> }));
vi.mock('@/shared/config', () => ({ initAppearance: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ initLanguage: vi.fn() }));
vi.mock('@/features/remote-control', () => ({ initRemote: vi.fn() }));
vi.mock('@/shared/api', () => ({ seedQuery: vi.fn() }));
vi.mock('@/entities/conference', () => ({ RECENT_KEY: 'recent', loadHomeCache: vi.fn() }));
vi.mock('@/app/model', () => ({ backfillTalkDetails: vi.fn(), buildReport: vi.fn() }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); document.body.innerHTML = '<div id="app"></div>'; });

test.each([false, true])('startup mounts React and seeds cached conferences when present: %s', async cached => {
  vi.mocked(loadHomeCache).mockReturnValue(cached ? [] : null);
  const listen = vi.spyOn(window, 'addEventListener');
  await import('../../index');
  expect(createRoot).toHaveBeenCalledWith(document.getElementById('app'));
  expect(window.cccbib.report).toBe(buildReport);
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
