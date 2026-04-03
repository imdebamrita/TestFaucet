import React, { useState, useEffect, useCallback } from 'react';
import CampaignCard from '../components/CampaignCard.jsx';
import { getAllCampaigns, getContribution } from '../lib/contract.js';
import './MyActivityPage.css';

export default function MyActivityPage({ publicKey, onSelectCampaign }) {
  const [created, setCreated] = useState([]);
  const [funded, setFunded] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('created');

  const fetchData = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const all = await getAllCampaigns(publicKey);

      // Created by me
      const myCreated = all.filter(
        (c) => c.creator.toLowerCase() === publicKey.toLowerCase()
      );
      setCreated(myCreated);

      // Campaigns I funded
      const fundedChecks = all
        .filter((c) => c.raised > 0)
        .map(async (c) => {
          try {
            const contrib = await getContribution(publicKey, c.id);
            return contrib > 0 ? c : null;
          } catch {
            return null;
          }
        });

      const fundedResults = await Promise.all(fundedChecks);
      setFunded(fundedResults.filter(Boolean));
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentList = activeTab === 'created' ? created : funded;

  return (
    <div className="activity-page animate-fade-in">
      <div className="activity-header">
        <h1>My <span className="gradient-text">Activity</span></h1>
        <p className="activity-subtitle">
          Track the campaigns you've created and funded.
        </p>
      </div>

      {/* Tabs */}
      <div className="activity-tabs">
        <button
          className={`activity-tab ${activeTab === 'created' ? 'activity-tab--active' : ''}`}
          onClick={() => setActiveTab('created')}
          id="tab-created"
        >
          <span className="tab-icon">🏗️</span>
          Created by Me
          <span className="tab-count">{created.length}</span>
        </button>
        <button
          className={`activity-tab ${activeTab === 'funded' ? 'activity-tab--active' : ''}`}
          onClick={() => setActiveTab('funded')}
          id="tab-funded"
        >
          <span className="tab-icon">💰</span>
          Funded by Me
          <span className="tab-count">{funded.length}</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="activity-loading">
          <span className="spinner spinner-lg" />
          <p>Loading your activity…</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">{activeTab === 'created' ? '🚀' : '🔍'}</span>
          <h3>
            {activeTab === 'created'
              ? 'No campaigns created yet'
              : 'No funded campaigns yet'}
          </h3>
          <p>
            {activeTab === 'created'
              ? 'Launch your first campaign to see it here!'
              : 'Start funding projects to track them here.'}
          </p>
        </div>
      ) : (
        <div className="campaign-grid">
          {currentList.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={onSelectCampaign}
            />
          ))}
        </div>
      )}
    </div>
  );
}
