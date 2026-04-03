import { useState, useCallback } from 'react';
import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api';

/**
 * Custom hook for Freighter wallet connection.
 * Handles connect, disconnect, and provides wallet state.
 */
export function useWallet() {
  const [publicKey, setPublicKey] = useState('');
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      // 1. Check if Freighter extension is installed
      const connected = await isConnected();
      if (!connected) {
        throw new Error('Freighter wallet extension not found. Please install it from freighter.app');
      }

      // 2. Request access or get existing address
      let result = null;
      try {
        result = await requestAccess();
      } catch {
        result = await getAddress();
      }

      // Freighter might return a string or an object { address: string }
      const key = typeof result === 'string' ? result : result?.address;

      if (key && typeof key === 'string' && key.startsWith('G')) {
        setPublicKey(key);
        return key;
      } else {
        throw new Error('Please unlock Freighter and approve the connection request.');
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey('');
  }, []);

  const truncatedKey = publicKey
    ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`
    : '';

  return {
    publicKey,
    connecting,
    connected: Boolean(publicKey),
    truncatedKey,
    connect,
    disconnect,
  };
}
