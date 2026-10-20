import React from 'react';

import MainView from './views/Main';
import { OfflineBanner } from './components/OfflineBanner';

const App = () => (
  <>
    <OfflineBanner />
    <MainView />
  </>
);

export default App;
