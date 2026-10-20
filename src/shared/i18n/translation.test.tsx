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
