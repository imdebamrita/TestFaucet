import React, { useState, useEffect } from 'react';
import { getBalance, getClaimAmount } from '../lib/contract.js';

function BalanceDisplay({ walletAddress, refreshKey }) {
  const [balance, setBalance] = useState(null);
  const [claimAmount, setClaimAmount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bal, amount] = await Promise.all([
          getBalance(walletAddress),
          getClaimAmount(walletAddress),
        ]);
        if (!cancelled) {
          setBalance(bal);
          setClaimAmount(amount);
        }
      } catch (err) {
        console.error('Failed to fetch balance data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [walletAddress, refreshKey]);

  const formatBalance = (val) => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="stats-grid">
      <div className="stat-card" id="stat-balance">
        <div className="stat-card__label">Your Balance</div>
        <div className="stat-card__value">
          {loading ? (
            <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 20, height: 20 }} />
          ) : (
            formatBalance(balance)
          )}
        </div>
        <div className="stat-card__unit">FAUCET tokens</div>
      </div>

      <div className="stat-card" id="stat-claim-amount">
        <div className="stat-card__label">Claim Amount</div>
        <div className="stat-card__value stat-card__value--accent">
          {loading ? (
            <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 20, height: 20 }} />
          ) : (
            formatBalance(claimAmount)
          )}
        </div>
        <div className="stat-card__unit">per claim</div>
      </div>
    </div>
  );
}

export default BalanceDisplay;
