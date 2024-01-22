import React from 'react';
import {
  HashRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';

import MainView from './views/Main';
import EventView from './views/Event';

const App = () => (
  <Router>
    <Routes>
      <Route exact path="/" element={<MainView />} />
      <Route exact path="/event/:id" element={<EventView />} />
    </Routes>
  </Router>
);

export default App;
