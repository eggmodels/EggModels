import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import ScheduleNFL from './components/ScheduleNFL';
import Blog from './components/Blog';
import Parlay from './components/Parlay';
import Rankings from './components/Rankings';
import NavBar from './components/NavBar';
import Home from './components/Home'
import Tennis from './components/Tennis'
import Secret from './components/Secret';
import Dashboard from './components/Dashboard';

// AppWrapper inside App.js
function AppWrapper() {
  const location = useLocation();
  const tabFromPath = location.pathname.split('/')[1].toUpperCase() || 'NFL';

  return (
    <>
      <NavBar activeTab={tabFromPath} />
      <Routes>
        <Route path="/nfl" element={<ScheduleNFL />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/nfl/parlay" element={<Parlay />} />
        <Route path="/nfl/rankings" element={<Rankings />} />
        {/* Default route (optional) */}
        <Route path="/" element={<Home />} />
        <Route path="/tennis" element={<Tennis />} />
        <Route path='/secret' element={<Secret />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AppWrapper />
      </div>
    </Router>
  );
}


export default App;
