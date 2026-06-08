import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ScheduleNFL from './components/ScheduleNFL';
import Blog from './components/Blog';
import Parlay from './components/Parlay';
import Rankings from './components/Rankings';
import NavBar from './components/NavBar';
import Home from './components/Home';
import Tennis from './components/Tennis';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nfl" element={<ScheduleNFL />} />
          <Route path="/nfl/parlay" element={<Parlay />} />
          <Route path="/nfl/rankings" element={<Rankings />} />
          <Route path="/tennis" element={<Tennis />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
