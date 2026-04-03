import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';

export default function Navbar({ publicKey, truncatedKey, connecting, onConnect, onDisconnect, activePage, onNavigate }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar" id="main-nav">
      <div className="navbar-inner">
        {/* Logo */}
        <button className="navbar-logo" onClick={() => onNavigate('home')} id="nav-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#grad1)" opacity="0.9"/>
              <path d="M2 17L12 22L22 17" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="url(#grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              <defs>
                <linearGradient id="grad1" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#a78bfa"/>
                  <stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">StellarCrowdfund</span>
        </button>

        {/* Navigation Links */}
        <div className="navbar-links">
          <button
            className={`nav-link ${activePage === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
            id="nav-explore"
          >
            Explore
          </button>
          {publicKey && (
            <>
              <button
                className={`nav-link ${activePage === 'create' ? 'active' : ''}`}
                onClick={() => onNavigate('create')}
                id="nav-create"
              >
                Create
              </button>
              <button
                className={`nav-link ${activePage === 'my' ? 'active' : ''}`}
                onClick={() => onNavigate('my')}
                id="nav-my-campaigns"
              >
                My Activity
              </button>
            </>
          )}
        </div>

        {/* Wallet */}
        <div className="navbar-wallet-area">
          {publicKey ? (
            <div className="wallet-pill" ref={dropdownRef}>
              <button
                className="wallet-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                id="wallet-btn"
              >
                <span className="wallet-dot" />
                <span className="wallet-addr">{truncatedKey}</span>
                <span className="wallet-chevron">{showDropdown ? '▲' : '▼'}</span>
              </button>

              {showDropdown && (
                <div className="wallet-dropdown animate-fade-in-down">
                  <div className="dropdown-header">
                    <span className="dropdown-label">Connected Wallet</span>
                    <span className="dropdown-addr mono">{publicKey}</span>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(publicKey); setShowDropdown(false); }}>
                    📋 Copy Address
                  </button>
                  <button
                    className="dropdown-item dropdown-item--danger"
                    onClick={() => { onDisconnect(); setShowDropdown(false); }}
                    id="btn-disconnect"
                  >
                    ⏏ Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={onConnect}
              disabled={connecting}
              id="btn-connect-wallet"
            >
              {connecting ? (
                <><span className="spinner" /> Connecting…</>
              ) : (
                '🔗 Connect Wallet'
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
