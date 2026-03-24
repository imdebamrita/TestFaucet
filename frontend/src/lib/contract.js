import { Address, scValToNative } from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import {
  buildContractTx,
  submitTx,
  simulateContractCall,
  NETWORK_PASSPHRASE,
} from './stellar.js';

// ── Contract IDs from env ────────────────────────────────────────────────────

const FAUCET_CONTRACT_ID = import.meta.env.VITE_FAUCET_CONTRACT_ID || '';
const TOKEN_CONTRACT_ID = import.meta.env.VITE_TOKEN_CONTRACT_ID || '';
const TOKEN_ASSET = import.meta.env.VITE_TOKEN_ASSET || '';

// ── Claim Tokens ─────────────────────────────────────────────────────────────

/**
 * Claim tokens from the faucet.
 * Builds the tx, signs via Freighter, and submits.
 */
export async function claimTokens(publicKey) {
  if (!FAUCET_CONTRACT_ID) throw new Error('Faucet contract ID not configured');

  const userAddress = new Address(publicKey);

  const tx = await buildContractTx(
    publicKey,
    FAUCET_CONTRACT_ID,
    'claim',
    userAddress.toScVal()
  );

  // Sign with Freighter
  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!signed.signedTxXdr) {
    throw new Error('Transaction signing was cancelled');
  }

  const result = await submitTx(signed.signedTxXdr);
  return result;
}

// ── Establish Trustline ──────────────────────────────────────────────────────

/**
 * Build, sign, and submit a ChangeTrust operation for the token.
 */
export async function establishTrustline(publicKey) {
  if (!TOKEN_ASSET) throw new Error('Token asset not configured in env');
  const [code, issuer] = TOKEN_ASSET.split(':');

  const { Asset, TransactionBuilder, BASE_FEE, Operation, Horizon } = await import('@stellar/stellar-sdk');
  const { server, NETWORK_PASSPHRASE } = await import('./stellar.js');

  const asset = new Asset(code, issuer);
  const account = await server.getAccount(publicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
      })
    )
    .setTimeout(60)
    .build();

  const signed = await signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    network: NETWORK_PASSPHRASE,
  });

  if (!signed.signedTxXdr) {
    throw new Error('Trustline signing was cancelled');
  }

  // Submit via Horizon as this is a classic operation
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  const txToSubmit = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  
  return await horizon.submitTransaction(txToSubmit);
}

// ── Get Last Claim ───────────────────────────────────────────────────────────

/**
 * Query the last claim timestamp for a user.
 * Returns timestamp in seconds (0 if never claimed).
 */
export async function getLastClaim(publicKey) {
  if (!FAUCET_CONTRACT_ID) return 0;

  try {
    const userAddress = new Address(publicKey);
    const sim = await simulateContractCall(
      publicKey,
      FAUCET_CONTRACT_ID,
      'get_last_claim',
      userAddress.toScVal()
    );

    if (sim.result) {
      const val = scValToNative(sim.result.retval);
      return Number(val);
    }
    return 0;
  } catch (err) {
    console.warn('Failed to get last claim:', err);
    return 0;
  }
}

// ── Get Balance ──────────────────────────────────────────────────────────────

/**
 * Query the user's token balance.
 * Returns the balance as a display number (divided by 10^7).
 */
export async function getBalance(publicKey) {
  if (!TOKEN_CONTRACT_ID) return 0;

  try {
    const userAddress = new Address(publicKey);
    const sim = await simulateContractCall(
      publicKey,
      TOKEN_CONTRACT_ID,
      'balance',
      userAddress.toScVal()
    );

    if (sim.result) {
      const raw = scValToNative(sim.result.retval);
      // Token uses 7 decimal places
      return Number(raw) / 1e7;
    }
    return 0;
  } catch (err) {
    console.warn('Failed to get balance:', err);
    return 0;
  }
}

// ── Get Claim Amount ─────────────────────────────────────────────────────────

/**
 * Query the configured claim amount.
 * Returns as display number.
 */
export async function getClaimAmount(publicKey) {
  if (!FAUCET_CONTRACT_ID) return 0;

  try {
    const sim = await simulateContractCall(
      publicKey,
      FAUCET_CONTRACT_ID,
      'get_claim_amount'
    );

    if (sim.result) {
      const raw = scValToNative(sim.result.retval);
      return Number(raw) / 1e7;
    }
    return 0;
  } catch (err) {
    console.warn('Failed to get claim amount:', err);
    return 0;
  }
}

// ── Get Cooldown ─────────────────────────────────────────────────────────────

/**
 * Query the cooldown period in seconds.
 */
export async function getCooldownPeriod(publicKey) {
  if (!FAUCET_CONTRACT_ID) return 86400;

  try {
    const sim = await simulateContractCall(
      publicKey,
      FAUCET_CONTRACT_ID,
      'get_cooldown'
    );

    if (sim.result) {
      const val = scValToNative(sim.result.retval);
      return Number(val);
    }
    return 86400;
  } catch (err) {
    console.warn('Failed to get cooldown:', err);
    return 86400;
  }
}
