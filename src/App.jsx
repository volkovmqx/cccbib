import React from 'react';
import {
  HashRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';

import MainView from './views/Main';

const App = () => (
  <Router>
    <Routes>
      <Route exact path="/" element={<MainView />} />
    </Routes>
  </Router>
);

export default App;
