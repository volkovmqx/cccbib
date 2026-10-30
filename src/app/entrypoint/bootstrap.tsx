import '../styles/fonts.css';
import '../styles/styles.css';
import '@/shared/branding/pixelIcons.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAppearance } from '@/shared/config';
import { initLanguage, loadActiveLanguage } from '@/shared/i18n';
import { RECENT_KEY } from '@/entities/conference';
import { seedQuery } from '@/shared/api';
import { loadHomeCache } from '@/entities/conference';
import { initRemote } from '@/features/remote-control';
import { refreshMirrors } from '@/entities/talk';
import { initScrollbars, isWebOS } from '@/shared/lib';
import { buildReport } from '@/app/model';
import { backfillTalkDetails } from '@/app/model';

window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    ['webpack-dev-server-client-overlay-div', 'webpack-dev-server-client-overlay'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('style', 'display: none');
    });
  }
});

if (isWebOS()) document.documentElement.setAttribute('data-webos', '');
initAppearance();
initLanguage();
initRemote();
refreshMirrors();
initScrollbars();
window.cccbib = { report: buildReport };

const cachedHome = loadHomeCache();
if (cachedHome) seedQuery(RECENT_KEY, { conferencesRecent: cachedHome });

loadActiveLanguage().then(() => createRoot(document.getElementById('app')!).render(<App />));
setTimeout(backfillTalkDetails, 4000);
