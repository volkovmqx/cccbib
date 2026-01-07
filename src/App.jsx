import React from 'react';
import {
  HashRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';

import MainView from './views/Main';
import { OfflineBanner } from './components/OfflineBanner';

const App = () => (
  <>
    <OfflineBanner />
    <Router>
      <Routes>
        <Route exact path="/" element={<MainView />} />
      </Routes>
    </Router>
  </>
);

export default App;
