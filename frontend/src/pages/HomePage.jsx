import React, { useState, useEffect, useCallback } from 'react';
import CampaignCard from '../components/CampaignCard.jsx';
import FundModal from '../components/FundModal.jsx';
import { getAllCampaigns, fundCampaign } from '../lib/contract.js';
import './HomePage.css';

export default function HomePage({ publicKey, onSelectCampaign, onNavigate, onToast }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [fundTarget, setFundTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllCampaigns(publicKey);
      setCampaigns(all.sort((a, b) => b.id - a.id));
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ── Fund Handler ────────────────────────────────────────────────────────

  const handleFund = async (campaignId, amount) => {
    if (!publicKey) return;
    setSubmitting(true);
    const tid = onToast('Signing transaction via Freighter…', 'loading');
    try {
      await fundCampaign(publicKey, campaignId, amount);
      onToast(`Successfully funded ${amount} tokens! 🎉`, 'success', tid);
      setFundTarget(null);
      fetchCampaigns();
    } catch (err) {
      onToast(err.message || 'Funding failed', 'error', tid);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filter === 'all'
    ? campaigns
    : campaigns.filter((c) => String(c.status) === filter);

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => String(c.status) === 'Active').length,
    totalRaised: campaigns.reduce((sum, c) => sum + c.raised, 0),
  };

  return (
    <div className="home-page animate-fade-in">
      {/* Hero Section */}
      <section className="hero" id="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Built on Stellar & Soroban
          </div>
          <h1 className="hero-title">
            Fund the <span className="gradient-text">Future</span> with
            <br />Blockchain Crowdfunding
          </h1>
          <p className="hero-subtitle">
            Launch your project on Stellar. Connect with a global network of backers.
            Transparent, secure, and fully on-chain.
          </p>
          <div className="hero-actions">
            {publicKey ? (
              <button className="btn btn-primary btn-lg" onClick={() => onNavigate('create')} id="btn-hero-create">
                🚀 Start a Campaign
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled>
                Connect Wallet to Start
              </button>
            )}
            <button className="btn btn-outline btn-lg" onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })} id="btn-hero-explore">
              Explore Projects ↓
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.total}</span>
              <span className="hero-stat-label">Campaigns</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.active}</span>
              <span className="hero-stat-label">Active Now</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.totalRaised.toFixed(0)}</span>
              <span className="hero-stat-label">Tokens Raised</span>
            </div>
          </div>
        </div>

        {/* Floating orbs */}
        <div className="hero-orb hero-orb--1" />
        <div className="hero-orb hero-orb--2" />
        <div className="hero-orb hero-orb--3" />
      </section>

      {/* Explore Section */}
      <section id="explore" className="explore-section">
        <div className="explore-header">
          <h2>Explore Campaigns</h2>
          <div className="explore-controls">
            <div className="filter-pills">
              {['all', 'Active', 'Success', 'Failed'].map((f) => (
                <button
                  key={f}
                  className={`filter-pill ${filter === f ? 'filter-pill--active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchCampaigns} disabled={loading} id="btn-refresh">
              {loading ? <span className="spinner" /> : '↻'} Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="campaign-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card skeleton-card">
                <div className="skeleton" style={{ height: 16, width: '40%' }} />
                <div className="skeleton" style={{ height: 20, width: '80%', marginTop: 12 }} />
                <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 8 }} />
                <div className="skeleton" style={{ height: 8, width: '100%', marginTop: 20 }} />
                <div className="skeleton" style={{ height: 14, width: '50%', marginTop: 12 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🌌</span>
            <h3>No campaigns found</h3>
            <p>Be the first to launch a project on-chain!</p>
          </div>
        ) : (
          <div className="campaign-grid">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={onSelectCampaign}
                onFund={(c) => setFundTarget(c)}
                publicKey={publicKey}
              />
            ))}
          </div>
        )}
      </section>

      {/* Fund Modal */}
      {fundTarget && (
        <FundModal
          campaign={fundTarget}
          onFund={handleFund}
          onClose={() => setFundTarget(null)}
          submitting={submitting}
        />
      )}
    </div>
  );
}
