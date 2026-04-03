import React, { useState } from 'react';
import './FundModal.css';

export default function FundModal({ campaign, onFund, onClose, submitting }) {
  const [amount, setAmount] = useState('10');

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (val > 0) {
      onFund(campaign.id, val);
    }
  };

  const progress = campaign.goal > 0 ? Math.min((campaign.raised / campaign.goal) * 100, 100) : 0;
  const remaining = Math.max(campaign.goal - campaign.raised, 0);

  return (
    <div className="fund-overlay" onClick={onClose} id="fund-modal-overlay">
      <div className="fund-modal glass-card animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className="fund-modal-close" onClick={onClose} id="btn-close-fund-modal">×</button>

        {/* Header */}
        <div className="fund-modal-header">
          <span className="fund-modal-emoji">💎</span>
          <h2>Fund this Project</h2>
          <p className="fund-modal-campaign-title">{campaign.title}</p>
        </div>

        {/* Progress */}
        <div className="fund-modal-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="fund-modal-stats">
            <span><strong>{campaign.raised.toFixed(1)}</strong> raised</span>
            <span><strong>{campaign.goal.toFixed(1)}</strong> goal</span>
          </div>
        </div>

        {/* Remaining */}
        <div className="fund-modal-remaining">
          <span className="remaining-label">Remaining to goal</span>
          <span className="remaining-value">{remaining.toFixed(1)} tokens</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="fund-modal-form">
          <div className="fund-modal-input-wrap">
            <input
              type="number"
              className="input-field fund-modal-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.1"
              step="any"
              placeholder="Enter amount"
              autoFocus
              id="input-fund-modal-amount"
            />
            <span className="fund-modal-input-label">tokens</span>
          </div>

          {/* Quick amounts */}
          <div className="fund-modal-presets">
            {[5, 10, 25, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                className={`preset-btn ${amount === String(v) ? 'preset-btn--active' : ''}`}
                onClick={() => setAmount(String(v))}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-secondary btn-lg fund-modal-submit"
            disabled={submitting || !amount || parseFloat(amount) <= 0}
            id="btn-submit-fund"
          >
            {submitting ? (
              <><span className="spinner" /> Processing…</>
            ) : (
              <>💎 Fund {amount || '0'} Tokens</>
            )}
          </button>

          <p className="fund-modal-note">
            Transaction will be signed via Freighter wallet
          </p>
        </form>
      </div>
    </div>
  );
}
