import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { detectLanguage, formatNumber, initLanguage, resolveLanguage, t, translate, useTranslation } from './translation';
import { setSetting } from '@/shared/config';

test('translation detects supported locales and preserves unknown text and placeholders', () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['xx', 'DE-de']);
  expect(detectLanguage()).toBe('de');
  expect(resolveLanguage('fr')).toBe('fr');
  expect(resolveLanguage('auto')).toBe('de');
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('unknown');
  expect(detectLanguage()).toBe('en');
  expect(translate('en', 'Unknown')).toBe('Unknown');
  expect(translate('unknown', 'Unknown')).toBe('Unknown');
  expect(translate('en', 'Hello {name} {missing}', { name: 'User' })).toBe('Hello User {missing}');
  expect(translate('de', 'Loading')).toBe('Wird geladen');
  expect(formatNumber('de', 1000)).toBe('1.000');
});

test('language initialization and hooks follow language changes', () => {
  setSetting('uiLanguage', 'en');
  const stop = initLanguage();
  const { result, unmount } = renderHook(useTranslation);
  expect(result.current('Loading')).toBe('Loading');
  act(() => { setSetting('uiLanguage', 'de'); });
  expect(result.current('Loading')).toBe('Wird geladen');
  expect(t('Loading')).toBe('Wird geladen');
  expect(document.documentElement.lang).toBe('de');
  act(() => { setSetting('uiFont', 'inter'); });
  expect(document.documentElement.lang).toBe('de');
  stop(); unmount();
});

test('number formatters are built once per language', () => {
  const build = vi.spyOn(Intl, 'NumberFormat');
  expect([formatNumber('nl', 1234), formatNumber('nl', 5678), formatNumber('nl', 90)]).toEqual(['1.234', '5.678', '90']);
  expect(build).toHaveBeenCalledTimes(1);
  build.mockRestore();
});

test('an empty entry in the browser language list is skipped', () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['', 'fr']);
  expect(detectLanguage()).toBe('fr');
});

test('a language is loaded when it is first used, until then the English text shows, and watchers are told', async () => {
  vi.resetModules();
  const fresh = await import('./translation');
  const { setSetting: setFresh } = await import('@/shared/config');
  setFresh('uiLanguage', 'de');
  expect(fresh.translate('de', 'Loading')).toBe('Loading');
  const view = renderHook(() => fresh.useTranslation());
  expect(view.result.current('Loading')).toBe('Loading');
  const first = fresh.loadLanguage('de');
  expect(fresh.loadLanguage('de')).toBe(first);
  await act(async () => { await first; });
  expect(fresh.translate('de', 'Loading')).toBe('Wird geladen');
  expect(view.result.current('Loading')).toBe('Wird geladen');
  await fresh.loadLanguage('de');
  await fresh.loadLanguage('en');
  await fresh.loadLanguage('xx');
  expect(fresh.translate('xx', 'Loading')).toBe('Loading');
});

test('the language of the saved setting is loaded at start and when it changes', async () => {
  vi.resetModules();
  const fresh = await import('./translation');
  const { setSetting: setFresh } = await import('@/shared/config');
  setFresh('uiLanguage', 'fr');
  const stop = fresh.initLanguage();
  expect(document.documentElement.lang).toBe('fr');
  await fresh.loadActiveLanguage();
  expect(fresh.translate('fr', 'Loading')).not.toBe('Loading');
  act(() => { setFresh('uiLanguage', 'it'); });
  await fresh.loadActiveLanguage();
  expect(fresh.translate('it', 'Loading')).not.toBe('Loading');
  stop();
});
