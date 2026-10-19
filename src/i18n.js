import { useCallback } from 'react';
import { getSetting, subscribeSettings, useSetting } from './settings';
import de from './locales/de';
import fr from './locales/fr';
import es from './locales/es';
import it from './locales/it';
import nl from './locales/nl';
import pt from './locales/pt';
import pl from './locales/pl';
import cs from './locales/cs';

const CATALOGS = { en: {}, de, fr, es, it, nl, pt, pl, cs };

export function detectLanguage() {
  const preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (let i = 0; i < preferred.length; i++) {
    const code = String(preferred[i] || '').toLowerCase().split('-')[0];
    if (CATALOGS[code]) return code;
  }
  return 'en';
}

export const resolveLanguage = (setting) => (CATALOGS[setting] ? setting : detectLanguage());

export function translate(language, text, params) {
  const catalog = CATALOGS[language];
  const translated = catalog && catalog[text] !== undefined ? catalog[text] : text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

export const t = (text, params) => translate(resolveLanguage(getSetting('uiLanguage')), text, params);

export function useLanguage() {
  const [setting] = useSetting('uiLanguage');
  return resolveLanguage(setting);
}

export function useTranslation() {
  const language = useLanguage();
  return useCallback((text, params) => translate(language, text, params), [language]);
}

export const formatNumber = (language, value) => value.toLocaleString(language);

export function initLanguage() {
  const apply = () => { document.documentElement.lang = resolveLanguage(getSetting('uiLanguage')); };
  apply();
  subscribeSettings((key) => {
    if (key === 'uiLanguage') apply();
  });
}
