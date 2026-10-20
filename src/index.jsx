import './fonts.css';
import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initAppearance } from './appearance';
import { initLanguage } from './i18n';
import { RECENT_KEY } from './data';
import { seedQuery } from './graphql';
import { loadHomeCache } from './helpers/homeCache';
import { initRemote } from './remote';
import { buildReport } from './helpers/report';
import { backfillTalkDetails } from './helpers/talkDetails';

window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    ['webpack-dev-server-client-overlay-div', 'webpack-dev-server-client-overlay'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('style', 'display: none');
    });
  }
});

initAppearance();
initLanguage();
initRemote();
window.cccbib = { report: buildReport };

const cachedHome = loadHomeCache();
if (cachedHome) seedQuery(RECENT_KEY, { conferencesRecent: cachedHome });

createRoot(document.getElementById('app')).render(<App />);
setTimeout(backfillTalkDetails, 4000);
