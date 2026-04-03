import React, { useState, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import HomePage from './pages/HomePage.jsx';
import CampaignDetailPage from './pages/CampaignDetailPage.jsx';
import CreateCampaignPage from './pages/CreateCampaignPage.jsx';
import MyActivityPage from './pages/MyActivityPage.jsx';
import { useWallet } from './hooks/useWallet.js';
import { useToast } from './hooks/useToast.js';

export default function App() {
  const wallet = useWallet();
  const { toasts, show, update, dismiss } = useToast();
  const [page, setPage] = useState('home');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // ── Navigation ──────────────────────────────────────────────────────────

  const navigate = useCallback((target) => {
    setPage(target);
    setSelectedCampaignId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const selectCampaign = useCallback((id) => {
    setSelectedCampaignId(id);
    setPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Wallet Handlers ────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      const key = await wallet.connect();
      show(`Connected: ${key.slice(0, 4)}…${key.slice(-4)}`, 'success');
    } catch (err) {
      show(err.message || 'Connection failed', 'error');
    }
  };

  const handleDisconnect = () => {
    wallet.disconnect();
    navigate('home');
    show('Wallet disconnected', 'success');
  };

  // ── Toast Bridge ────────────────────────────────────────────────────────
  // Pages call onToast(msg, type, existingId?) → returns toast id

  const handleToast = useCallback((message, type, existingId) => {
    if (existingId) {
      update(existingId, message, type);
      return existingId;
    }
    return show(message, type);
  }, [show, update]);

  // ── Render Page ─────────────────────────────────────────────────────────

  const renderPage = () => {
    switch (page) {
      case 'detail':
        return (
          <CampaignDetailPage
            publicKey={wallet.publicKey}
            campaignId={selectedCampaignId}
            onBack={() => navigate('home')}
            onToast={handleToast}
          />
        );

      case 'create':
        return wallet.publicKey ? (
          <CreateCampaignPage
            publicKey={wallet.publicKey}
            onSuccess={() => navigate('home')}
            onToast={handleToast}
          />
        ) : (
          <div className="empty-state" style={{ padding: '8rem 2rem' }}>
            <span className="empty-state-icon">🔒</span>
            <h3>Wallet Required</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Connect your Freighter wallet to create a campaign.
            </p>
            <button className="btn btn-primary" onClick={handleConnect}>
              🔗 Connect Wallet
            </button>
          </div>
        );

      case 'my':
        return wallet.publicKey ? (
          <MyActivityPage
            publicKey={wallet.publicKey}
            onSelectCampaign={selectCampaign}
          />
        ) : (
          <div className="empty-state" style={{ padding: '8rem 2rem' }}>
            <span className="empty-state-icon">🔒</span>
            <h3>Wallet Required</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Connect your Freighter wallet to see your activity.
            </p>
            <button className="btn btn-primary" onClick={handleConnect}>
              🔗 Connect Wallet
            </button>
          </div>
        );

      default:
        return (
          <HomePage
            publicKey={wallet.publicKey}
            onSelectCampaign={selectCampaign}
            onNavigate={navigate}
            onToast={handleToast}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Navbar
        publicKey={wallet.publicKey}
        truncatedKey={wallet.truncatedKey}
        connecting={wallet.connecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        activePage={page}
        onNavigate={navigate}
      />

      <main className="page-wrapper">
        {renderPage()}
      </main>

      <footer className="app-footer">
        <p>© 2026 StellarCrowdfund · Powered by Soroban Smart Contracts</p>
        <p>
          <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">Stellar</a>
          {' · '}
          <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer">Freighter Wallet</a>
        </p>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
