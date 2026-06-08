import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import egglogo from '../logosnfl/egg.png';
import '../css/Navbar.css';

function NavBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="navbar-container">
      <div className="navbar-logo-wrapper">
        <img src={egglogo} alt="eggModels logo" className="navbar-logo" />
      </div>
      <nav className="navbar">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>

        <div
          className="dropdown"
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <NavLink
            to="/nfl"
            end={false}
            className={({ isActive }) =>
              `dropdown-toggle${isActive ? ' active' : ''}`
            }
          >
            NFL
          </NavLink>
          {dropdownOpen && (
            <div className="dropdown-menu">
              <NavLink
                to="/nfl/parlay"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Parlay
              </NavLink>
              <NavLink
                to="/nfl/rankings"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Rankings
              </NavLink>
            </div>
          )}
        </div>

        <NavLink to="/blog" className={({ isActive }) => (isActive ? 'active' : '')}>
          Blog
        </NavLink>
      </nav>
    </div>
  );
}

export default NavBar;
