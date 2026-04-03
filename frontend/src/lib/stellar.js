import { rpc, Networks, Contract, TransactionBuilder, Transaction, Account, BASE_FEE, Keypair, Asset, Operation, scValToNative } from '@stellar/stellar-sdk';

// ── Network Configuration ────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// ── RPC Server ───────────────────────────────────────────────────────────────

export const server = new rpc.Server(RPC_URL, {
  allowHttp: true,
});

// ── Build Contract Transaction ───────────────────────────────────────────────

/**
 * Build a Soroban transaction for contract invocation.
 * Uses server.prepareTransaction() which handles simulation + assembly.
 */
export async function buildContractTx(sourcePublicKey, contractId, method, ...args) {
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // prepareTransaction does simulate + assemble in one step
  const prepared = await server.prepareTransaction(tx);
  return prepared;
}

// ── Submit Transaction ───────────────────────────────────────────────────────

/**
 * Submit a signed transaction XDR and wait for result.
 * Uses raw JSON-RPC to avoid SDK XDR parsing issues with Soroban envelopes.
 */
export async function submitTx(signedXdr) {
  // ── Send ────────────────────────────────────────────────────────────────
  const sendRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: { transaction: signedXdr },
    }),
  });
  const sendJson = await sendRes.json();

  if (sendJson.error) {
    throw new Error(`RPC error: ${sendJson.error.message || JSON.stringify(sendJson.error)}`);
  }

  const sendResult = sendJson.result;
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction failed: ${sendResult.errorResultXdr || 'unknown error'}`);
  }

  const hash = sendResult.hash;

  // ── Poll ────────────────────────────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));

    const pollRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: { hash },
      }),
    });
    const pollJson = await pollRes.json();
    const txResult = pollJson.result;

    if (!txResult || txResult.status === 'NOT_FOUND') {
      continue;
    }

    if (txResult.status === 'SUCCESS') {
      return txResult;
    }

    if (txResult.status === 'FAILED') {
      throw new Error(`Transaction failed on-chain: ${txResult.resultXdr || 'unknown'}`);
    }
  }

  throw new Error('Transaction not found after 60s. Check Stellar explorer.');
}

// ── Simulate Contract Call ───────────────────────────────────────────────────

/**
 * Simulate a read-only contract call (no signing needed).
 * Always uses a dummy account — simulations don't require funded accounts.
 */
export async function simulateContractCall(sourcePublicKey, contractId, method, ...args) {
  // For simulations, we never need a real on-chain account.
  const simSource = sourcePublicKey || Keypair.random().publicKey();
  const account = new Account(simSource, '0');

  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation error: ${simulated.error}`);
  }

  return simulated;
}

// ── Ensure Trustline ─────────────────────────────────────────────────────────

/**
 * Check if the user has a trustline for the given SAC token contract.
 * If not, build + sign + submit a changeTrust transaction via Freighter.
 * Returns true if trustline exists or was created, false on error.
 */
export async function ensureTrustline(publicKey, tokenContractId, signTransactionFn) {
  // 1. Query Horizon for the token contract's underlying asset
  //    We do this by looking up the contract via Soroban, but for SAC tokens
  //    the simplest approach is to check Horizon for the account's balances.
  
  try {
    // Check if account already has a trustline by trying a balance lookup
    const acctRes = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (!acctRes.ok) {
      console.warn('Could not fetch account from Horizon');
      return true; // proceed anyway, let the contract error if needed
    }
    
    const acctData = await acctRes.json();
    
    // Look up the asset info for this SAC contract
    // Try to find what asset this SAC wraps by querying the contract
    const assetInfo = await getTokenAssetInfo(tokenContractId);
    
    if (!assetInfo) {
      console.warn('Could not determine underlying asset for token contract');
      return true; // proceed anyway
    }
    
    // Check if the account already has this trustline
    const hasTrustline = acctData.balances?.some((b) => {
      if (assetInfo.isNative) return b.asset_type === 'native';
      return b.asset_code === assetInfo.code && b.asset_issuer === assetInfo.issuer;
    });
    
    if (hasTrustline) {
      return true; // Already set up
    }
    
    // 2. Build changeTrust transaction
    console.log('Creating trustline for', assetInfo.code, '…');
    
    const asset = new Asset(assetInfo.code, assetInfo.issuer);
    const account = await server.getAccount(publicKey);
    
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({ asset }))
      .setTimeout(60)
      .build();
    
    // Sign via Freighter
    const xdrString = tx.toEnvelope().toXDR('base64');
    const signed = await signTransactionFn(xdrString, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    
    if (!signed.signedTxXdr) {
      throw new Error('Trustline creation was cancelled.');
    }
    
    // Submit via Horizon (classic transaction, not Soroban)
    const submitRes = await fetch(`${HORIZON_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(signed.signedTxXdr)}`,
    });
    
    const submitData = await submitRes.json();
    
    if (!submitRes.ok) {
      console.error('Trustline creation failed:', submitData);
      throw new Error(submitData.extras?.result_codes?.operations?.[0] || 'Trustline creation failed');
    }
    
    console.log('Trustline created successfully!');
    return true;
  } catch (err) {
    console.error('ensureTrustline error:', err);
    throw err;
  }
}

/**
 * Query the token contract to discover the underlying classic asset.
 * SAC contracts have name() and symbol() that match the asset.
 */
async function getTokenAssetInfo(tokenContractId) {
  try {
    // Try to get the asset name and symbol from the token contract
    const simSource = Keypair.random().publicKey();
    const account = new Account(simSource, '0');
    const contract = new Contract(tokenContractId);

    // Get symbol
    const symTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('symbol'))
      .setTimeout(30)
      .build();

    const symSim = await server.simulateTransaction(symTx);
    const symbol = symSim.result ? scValToNative(symSim.result.retval) : null;

    // Get admin/issuer - try to find the asset on Horizon by searching
    if (symbol) {
      // Search Horizon for this asset
      const assetRes = await fetch(`${HORIZON_URL}/assets?asset_code=${symbol}&limit=10`);
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        if (assetData._embedded?.records?.length > 0) {
          const record = assetData._embedded.records[0];
          return {
            code: record.asset_code,
            issuer: record.asset_issuer,
            isNative: false,
          };
        }
      }
    }
    
    return null;
  } catch (err) {
    console.warn('Failed to get token asset info:', err);
    return null;
  }
}
