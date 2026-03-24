import React, { useState, useEffect, useCallback } from 'react';
import { claimTokens, getLastClaim, getCooldownPeriod, establishTrustline } from '../lib/contract.js';

function ClaimTokens({ walletAddress, onClaimSuccess, refreshKey }) {
  const [lastClaim, setLastClaim] = useState(null);
  const [cooldown, setCooldown] = useState(86400);
  const [timeLeft, setTimeLeft] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [needsTrustline, setNeedsTrustline] = useState(false);
  const [establishingTrust, setEstablishingTrust] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message: string }

  // Fetch last claim & cooldown
  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;
    const fetchData = async () => {
      try {
        const [lc, cd] = await Promise.all([
          getLastClaim(walletAddress),
          getCooldownPeriod(walletAddress),
        ]);
        if (!cancelled) {
          setLastClaim(lc);
          setCooldown(cd);
        }
      } catch (err) {
        console.error('Failed to fetch claim data:', err);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [walletAddress, refreshKey]);

  // Countdown timer
  useEffect(() => {
    const calcTimeLeft = () => {
      if (lastClaim === null) return null; // loading state
      if (lastClaim === 0) return 0;
      const now = Math.floor(Date.now() / 1000);
      const nextClaimAt = lastClaim + cooldown;
      return Math.max(0, nextClaimAt - now);
    };

    setTimeLeft(calcTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastClaim, cooldown]);

  const formatTimeLeft = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatLastClaim = (timestamp) => {
    if (timestamp === null) return 'Loading...';
    if (timestamp === 0) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const canClaim = timeLeft === 0 && !claiming && lastClaim !== null && !needsTrustline;

  const handleClaim = useCallback(async () => {
    if (!canClaim) return;
    setClaiming(true);
    setStatus(null);
    setNeedsTrustline(false);

    try {
      await claimTokens(walletAddress);
      setStatus({ type: 'success', message: 'Tokens claimed successfully! 🎉' });
      // Update last claim to now
      setLastClaim(Math.floor(Date.now() / 1000));
      onClaimSuccess?.();
    } catch (err) {
      console.error('Claim failed:', err);
      let message = 'Claim failed. ';
      const errorStr = String(err.message || err);

      if (errorStr.includes('Cooldown')) {
        message += 'Cooldown period not met.';
      } else if (errorStr.includes('cancelled')) {
        message += 'Transaction was cancelled.';
      } else if (errorStr.includes('trustline entry is missing')) {
        message = 'You need to establish a trustline for this token first.';
        setNeedsTrustline(true);
      } else if (errorStr.includes('UnreachableCodeReached') || errorStr.includes('InvalidAction')) {
        message = 'You have already claimed within the cooldown period. Please wait.';
      } else {
        message += err.message || 'Please try again.';
      }

      setStatus({ type: 'error', message });
    } finally {
      setClaiming(false);
    }
  }, [canClaim, walletAddress, onClaimSuccess]);

  const handleTrustline = useCallback(async () => {
    setEstablishingTrust(true);
    setStatus(null);

    try {
      await establishTrustline(walletAddress);
      setStatus({ type: 'success', message: 'Trustline established! You can now claim tokens.' });
      setNeedsTrustline(false);
    } catch (err) {
      console.error('Trustline failed:', err);
      let message = 'Failed to establish trustline. ';
      if (String(err.message || err).includes('cancelled')) {
        message += 'Transaction was cancelled.';
      } else {
        message += err.message || 'Please try again.';
      }
      setStatus({ type: 'error', message });
    } finally {
      setEstablishingTrust(false);
    }
  }, [walletAddress]);

  return (
    <div>
      {/* Last Claim Info */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card" id="stat-last-claim">
          <div className="stat-card__label">Last Claim</div>
          <div className="stat-card__value" style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
            {formatLastClaim(lastClaim)}
          </div>
        </div>
        <div className="stat-card" id="stat-cooldown">
          <div className="stat-card__label">Cooldown</div>
          <div className="stat-card__value" style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
            {cooldown / 3600}h
          </div>
        </div>
      </div>

      {/* Cooldown Warning */}
      {timeLeft !== null && timeLeft > 0 && (
        <div className="cooldown" id="cooldown-bar">
          <span className="cooldown__icon">⏳</span>
          <div>
            <div className="cooldown__text">Next claim available in</div>
            <div className="cooldown__time">{formatTimeLeft(timeLeft)}</div>
          </div>
        </div>
      )}

      {/* Asset Trustline / Claim Button */}
      {needsTrustline ? (
        <button
          className="btn btn--primary"
          style={{ width: '100%', fontSize: '1.05rem', padding: '1rem 2rem' }}
          onClick={handleTrustline}
          disabled={establishingTrust}
          id="btn-trustline"
        >
          {establishingTrust ? (
            <>
              <span className="spinner" /> Establishing…
            </>
          ) : (
            <>🔗 Establish Trustline</>
          )}
        </button>
      ) : (
        <button
          className="btn btn--claim"
          onClick={handleClaim}
          disabled={!canClaim}
          id="btn-claim"
        >
          {timeLeft === null ? (
            <>
              <span className="spinner" /> Loading Data…
            </>
          ) : claiming ? (
            <>
              <span className="spinner" /> Claiming…
            </>
          ) : timeLeft > 0 ? (
            <>⏳ Cooldown Active</>
          ) : (
            <>💧 Claim Tokens</>
          )}
        </button>
      )}

      {/* Status Message */}
      {status && (
        <div className={`status status--${status.type}`} id="claim-status">
          {status.type === 'success' ? '✅' : '❌'} {status.message}
        </div>
      )}
    </div>
  );
}

export default ClaimTokens;
