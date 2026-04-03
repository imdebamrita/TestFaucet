import React from 'react';
import './CampaignCard.css';

export default function CampaignCard({ campaign, onClick, onFund, publicKey }) {
  const { id, title, description, goal, raised, deadline } = campaign;
  const status = String(campaign.status || 'Active');
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;

  const getTimeRemaining = () => {
    const now = Date.now() / 1000;
    const diff = deadline - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h left`;
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m left`;
  };

  const badgeClass = {
    Active: 'badge-active',
    Success: 'badge-success',
    Failed: 'badge-failed',
  }[status] || 'badge-active';

  const isActive = status === 'Active' && (Date.now() / 1000) < deadline;

  return (
    <div className="campaign-card glass-card" id={`campaign-card-${id}`}>
      {/* Clickable area for navigation */}
      <div className="card-clickable" onClick={() => onClick(id)}>
        {/* Card Header */}
        <div className="card-header">
          <div className="card-badge-row">
            <span className={`badge ${badgeClass}`}>
              <span className={`badge-dot badge-dot--${status.toLowerCase()}`} />
              {status}
            </span>
            <span className="card-time">{getTimeRemaining()}</span>
          </div>
          <h3 className="card-title">{title}</h3>
          <p className="card-desc">{description}</p>
        </div>

        {/* Progress */}
        <div className="card-progress-section">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="card-stats-row">
            <div className="card-stat">
              <span className="card-stat-value">{raised.toFixed(1)}</span>
              <span className="card-stat-label">raised</span>
            </div>
            <div className="card-stat card-stat--right">
              <span className="card-stat-value">{goal.toFixed(1)}</span>
              <span className="card-stat-label">goal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with actions */}
      <div className="card-footer">
        <span className="card-percent">{progress.toFixed(0)}% funded</span>
        <div className="card-actions">
          {isActive && publicKey && onFund && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => { e.stopPropagation(); onFund(campaign); }}
              id={`btn-fund-card-${id}`}
            >
              💎 Fund
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onClick(id)}
          >
            Details →
          </button>
        </div>
      </div>
    </div>
  );
}
