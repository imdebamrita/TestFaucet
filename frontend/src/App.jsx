import React, { useState, useEffect, useCallback } from 'react';
import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetwork,
} from '@stellar/freighter-api';
import BalanceDisplay from './components/BalanceDisplay.jsx';
import ClaimTokens from './components/ClaimTokens.jsx';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check Freighter on mount
  useEffect(() => {
    const checkFreighter = async () => {
      try {
        const connected = await isConnected();
        setIsFreighterInstalled(connected.isConnected);

        if (connected.isConnected) {
          try {
            const pubKey = await getPublicKey();
            if (pubKey.address) {
              setWalletAddress(pubKey.address);
            }
          } catch {
            // Not yet authorized — that's fine
          }
        }
      } catch {
        setIsFreighterInstalled(false);
      }
    };
    checkFreighter();
  }, []);

  const connectWallet = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const access = await requestAccess();
      if (access.address) {
        setWalletAddress(access.address);
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setConnecting(false);
    }
  }, [connecting]);

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  const handleClaimSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="header__icon">💧</span>
        <h1 className="header__title">Stellar Token Faucet</h1>
        <p className="header__subtitle">
          Claim free testnet tokens every 24 hours, powered by Soroban smart contracts.
        </p>
      </header>

      {/* Main Content */}
      {walletAddress ? (
        <>
          {/* Wallet Info Card */}
          <div className="card wallet-section">
            <div className="wallet-info">
              <div className="wallet-info__dot" />
              <div>
                <div className="wallet-info__label">Connected Wallet</div>
                <div className="wallet-info__address" title={walletAddress}>
                  {truncateAddress(walletAddress)}
                </div>
              </div>
            </div>

            <BalanceDisplay
              walletAddress={walletAddress}
              refreshKey={refreshKey}
            />
          </div>

          {/* Claim Card */}
          <div className="card">
            <ClaimTokens
              walletAddress={walletAddress}
              onClaimSuccess={handleClaimSuccess}
              refreshKey={refreshKey}
            />
          </div>

          {/* Disconnect Button */}
          <div style={{ marginTop: '1rem', width: '100%', maxWidth: '480px' }}>
            <button
              className="btn btn--outline btn--sm"
              onClick={disconnectWallet}
              id="btn-disconnect"
            >
              ✕ Disconnect Wallet
            </button>
          </div>
        </>
      ) : (
        /* Not Connected */
        <div className="card">
          <div className="not-connected">
            <span className="not-connected__icon">🔗</span>
            <h2 className="not-connected__title">Connect Your Wallet</h2>
            <p className="not-connected__desc">
              {isFreighterInstalled
                ? 'Connect your Freighter wallet to claim tokens from the faucet.'
                : 'Install the Freighter browser extension to get started.'}
            </p>
            {isFreighterInstalled ? (
              <button
                className="btn btn--primary"
                onClick={connectWallet}
                disabled={connecting}
                id="btn-connect"
              >
                {connecting ? (
                  <>
                    <span className="spinner" /> Connecting…
                  </>
                ) : (
                  <>🚀 Connect Freighter</>
                )}
              </button>
            ) : (
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary"
                id="btn-install-freighter"
              >
                📥 Install Freighter
              </a>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>
          Built on{' '}
          <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">
            Stellar
          </a>{' '}
          with{' '}
          <a href="https://soroban.stellar.org" target="_blank" rel="noopener noreferrer">
            Soroban
          </a>{' '}
          smart contracts
        </p>
      </footer>
    </div>
  );
}

export default App;
