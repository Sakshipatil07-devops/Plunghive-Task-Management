import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function Navbar({ health }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-left" ref={menuRef}>
        <button
          className="menu-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="menu-icon"><span /><span /><span /></span>
        </button>

        {menuOpen && (
          <div className="menu-dropdown">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Tasks
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink
                to="/employees"
                className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Employees
              </NavLink>
            )}
          </div>
        )}

        <Logo />
      </div>

      <div className="navbar-right">
        {health && (
          <div className="aws-status" title="Live once AWS credentials are configured in server/.env">
            <span className={`dot ${health.aws.s3 ? 'live' : 'off'}`} /> S3
            <span className={`dot ${health.aws.sns ? 'live' : 'off'}`} /> SNS
            <span className={`dot ${health.aws.cloudwatch ? 'live' : 'off'}`} /> CloudWatch
          </div>
        )}
        {user && (
          <div className="user-menu">
            <span className="avatar">{initials(user.name)}</span>
            <span className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="pill role">{user.role}</span>
            </span>
            <button className="logout-btn" onClick={logout}>Log out</button>
          </div>
        )}
      </div>
    </nav>
  );
}
