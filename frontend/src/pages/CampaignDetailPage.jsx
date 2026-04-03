import React, { useState, useEffect, useCallback } from 'react';
import { getCampaign, fundCampaign, withdrawFunds, claimRefund, getContribution } from '../lib/contract.js';
import './CampaignDetailPage.css';

export default function CampaignDetailPage({ publicKey, campaignId, onBack, onToast }) {
  const [campaign, setCampaign] = useState(null);
  const [contribution, setContribution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fundingAmount, setFundingAmount] = useState('10');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, contrib] = await Promise.all([
        getCampaign(publicKey, campaignId),
        publicKey ? getContribution(publicKey, campaignId) : Promise.resolve(0),
      ]);
      setCampaign(c);
      setContribution(contrib);
    } catch (err) {
      console.error('Failed to fetch campaign:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFund = async () => {
    const amount = parseFloat(fundingAmount);
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    const tid = onToast('Processing your contribution…', 'loading');
    try {
      await fundCampaign(publicKey, campaignId, amount);
      onToast('Successfully funded! 🎉', 'success', tid);
      fetchData();
    } catch (err) {
      onToast(err.message || 'Funding failed', 'error', tid);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    const tid = onToast('Withdrawing funds…', 'loading');
    try {
      await withdrawFunds(publicKey, campaignId);
      onToast('Funds withdrawn successfully! 💰', 'success', tid);
      fetchData();
    } catch (err) {
      onToast(err.message || 'Withdrawal failed', 'error', tid);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefund = async () => {
    setSubmitting(true);
    const tid = onToast('Claiming your refund…', 'loading');
    try {
      await claimRefund(publicKey, campaignId);
      onToast('Refund claimed! 💸', 'success', tid);
      fetchData();
    } catch (err) {
      onToast(err.message || 'Refund failed', 'error', tid);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="detail-page animate-fade-in">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div className="detail-loading">
          <span className="spinner spinner-lg" />
          <p>Loading campaign details…</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="detail-page animate-fade-in">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <h3>Campaign Not Found</h3>
          <p>This campaign may have been removed or doesn't exist.</p>
        </div>
      </div>
    );
  }

  const progress = campaign.goal > 0 ? Math.min((campaign.raised / campaign.goal) * 100, 100) : 0;
  const status = String(campaign.status || 'Active');
  const isOwner = publicKey === campaign.creator;
  const now = Date.now() / 1000;
  const isEnded = now >= campaign.deadline;
  const isActive = status === 'Active' && !isEnded;
  const isSuccess = status === 'Success';
  const isFailed = isEnded && !isSuccess;

  const getTimeRemaining = () => {
    const diff = campaign.deadline - now;
    if (diff <= 0) return 'Campaign Ended';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    return `${days}d ${hours}h remaining`;
  };

  const badgeClass = {
    Active: 'badge-active',
    Success: 'badge-success',
    Failed: 'badge-failed',
  }[status] || 'badge-active';

  return (
    <div className="detail-page animate-fade-in">
      <button className="btn btn-ghost btn-sm detail-back" onClick={onBack} id="btn-back">
        ← Back to Campaigns
      </button>

      <div className="detail-card glass-card">
        {/* Header */}
        <div className="detail-top">
          <div className="detail-top-left">
            <span className={`badge ${badgeClass}`}>
              <span className={`badge-dot badge-dot--${status.toLowerCase()}`} />
              {status}
            </span>
            <span className="detail-time">{getTimeRemaining()}</span>
          </div>
        </div>

        <h1 className="detail-title">{campaign.title}</h1>
        <p className="detail-description">{campaign.description}</p>

        {/* Stats Grid */}
        <div className="detail-stats-grid">
          <div className="detail-stat-item">
            <span className="detail-stat-label">Raised</span>
            <span className="detail-stat-number">{campaign.raised.toFixed(2)}</span>
            <span className="detail-stat-unit">tokens</span>
          </div>
          <div className="detail-stat-item">
            <span className="detail-stat-label">Goal</span>
            <span className="detail-stat-number">{campaign.goal.toFixed(2)}</span>
            <span className="detail-stat-unit">tokens</span>
          </div>
          <div className="detail-stat-item">
            <span className="detail-stat-label">Progress</span>
            <span className="detail-stat-number">{progress.toFixed(1)}</span>
            <span className="detail-stat-unit">%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="detail-progress">
          <div className="progress-track" style={{ height: 12 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Meta */}
        <div className="detail-meta">
          <div className="meta-row">
            <span className="meta-label">Creator</span>
            <span className="meta-value mono">
              {campaign.creator.slice(0, 8)}…{campaign.creator.slice(-8)}
              {isOwner && <span className="meta-you-badge">You</span>}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Deadline</span>
            <span className="meta-value">
              {new Date(campaign.deadline * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Campaign ID</span>
            <span className="meta-value mono">#{campaign.id}</span>
          </div>
        </div>

        {/* Your Contribution */}
        {contribution > 0 && (
          <div className="contribution-banner">
            <span className="contribution-dot" />
            You contributed <strong>{contribution.toFixed(2)} tokens</strong> to this campaign
          </div>
        )}

        {/* Actions */}
        <div className="detail-actions">
          {/* Fund */}
          {isActive && publicKey && (
            <div className="fund-section">
              <h3>Fund this Project</h3>
              <div className="fund-input-row">
                <div className="fund-input-wrapper">
                  <input
                    type="number"
                    className="input-field fund-input"
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(e.target.value)}
                    min="0.1"
                    step="any"
                    placeholder="Amount"
                    id="input-fund-amount"
                  />
                  <span className="fund-input-suffix">tokens</span>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleFund}
                  disabled={submitting || !fundingAmount}
                  id="btn-fund"
                >
                  {submitting ? <span className="spinner" /> : '💎'} Fund Project
                </button>
              </div>
              <div className="fund-presets">
                {[5, 10, 25, 50, 100].map((v) => (
                  <button key={v} className="btn btn-ghost btn-sm" onClick={() => setFundingAmount(String(v))}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Withdraw */}
          {isOwner && isSuccess && isEnded && !campaign.withdrawn && (
            <div className="action-banner action-banner--success">
              <div>
                <h3>🎉 Campaign Successful!</h3>
                <p>Your campaign met its goal. You can now withdraw the raised funds.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleWithdraw}
                disabled={submitting}
                id="btn-withdraw"
              >
                Withdraw {campaign.raised.toFixed(1)} tokens
              </button>
            </div>
          )}

          {/* Already withdrawn */}
          {isOwner && campaign.withdrawn && (
            <div className="action-banner action-banner--withdrawn">
              <span>✓ Funds have been successfully withdrawn</span>
            </div>
          )}

          {/* Refund */}
          {isFailed && contribution > 0 && (
            <div className="action-banner action-banner--refund">
              <div>
                <h3>Campaign didn't reach its goal</h3>
                <p>You can claim a refund of your {contribution.toFixed(2)} token contribution.</p>
              </div>
              <button
                className="btn btn-danger"
                onClick={handleRefund}
                disabled={submitting}
                id="btn-refund"
              >
                Claim Refund
              </button>
            </div>
          )}

          {/* Not connected */}
          {!publicKey && isActive && (
            <div className="action-banner action-banner--info">
              <span>🔗 Connect your wallet to fund this project</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
