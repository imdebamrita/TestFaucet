import { Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import {
  buildContractTx,
  submitTx,
  simulateContractCall,
  ensureTrustline,
  NETWORK_PASSPHRASE,
} from './stellar.js';

// ── Contract ID from env ─────────────────────────────────────────────────────

const CROWDFUNDING_CONTRACT_ID = import.meta.env.VITE_CROWDFUNDING_CONTRACT_ID || '';
const TOKEN_CONTRACT_ID = import.meta.env.VITE_TOKEN_CONTRACT_ID || '';

// ── Helper: sign + submit a built transaction ────────────────────────────────

async function signAndSubmit(tx) {
  // Get base64 XDR - try multiple approaches for SDK compatibility
  let xdrString;
  if (typeof tx.toXDR === 'function') {
    // SDK v13: toXDR() may return Buffer or string
    const raw = tx.toXDR();
    xdrString = typeof raw === 'string' ? raw : Buffer.from(raw).toString('base64');
  } else if (typeof tx.toEnvelope === 'function') {
    const env = tx.toEnvelope();
    const raw = env.toXDR();
    xdrString = typeof raw === 'string' ? raw : Buffer.from(raw).toString('base64');
  } else {
    throw new Error('Cannot serialize transaction to XDR');
  }

  const signed = await signTransaction(xdrString, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (!signed.signedTxXdr) {
    throw new Error('Transaction signing was cancelled by the user.');
  }
  return await submitTx(signed.signedTxXdr);
}

// ── Create Campaign ──────────────────────────────────────────────────────────

export async function createCampaign(publicKey, title, desc, goalXLM, deadline) {
  if (!CROWDFUNDING_CONTRACT_ID) throw new Error('Crowdfunding contract ID not configured');

  const creatorAddr = new Address(publicKey);
  const goalRaw = BigInt(Math.round(goalXLM * 1e7));

  const tx = await buildContractTx(
    publicKey,
    CROWDFUNDING_CONTRACT_ID,
    'create_campaign',
    creatorAddr.toScVal(),
    nativeToScVal(title, { type: 'string' }),
    nativeToScVal(desc, { type: 'string' }),
    nativeToScVal(goalRaw, { type: 'i128' }),
    nativeToScVal(deadline, { type: 'u64' }),
  );

  return await signAndSubmit(tx);
}

// ── Fund Campaign ────────────────────────────────────────────────────────────

export async function fundCampaign(publicKey, campaignId, amountXLM) {
  if (!CROWDFUNDING_CONTRACT_ID) throw new Error('Crowdfunding contract ID not configured');

  // Ensure the user has a trustline for the funding token
  if (TOKEN_CONTRACT_ID) {
    await ensureTrustline(publicKey, TOKEN_CONTRACT_ID, signTransaction);
  }

  const funderAddr = new Address(publicKey);
  const amountRaw = BigInt(Math.round(amountXLM * 1e7));

  const tx = await buildContractTx(
    publicKey,
    CROWDFUNDING_CONTRACT_ID,
    'fund',
    nativeToScVal(campaignId, { type: 'u32' }),
    funderAddr.toScVal(),
    nativeToScVal(amountRaw, { type: 'i128' }),
  );

  return await signAndSubmit(tx);
}

// ── Withdraw Funds ───────────────────────────────────────────────────────────

export async function withdrawFunds(publicKey, campaignId) {
  if (!CROWDFUNDING_CONTRACT_ID) throw new Error('Crowdfunding contract ID not configured');

  const callerAddr = new Address(publicKey);

  const tx = await buildContractTx(
    publicKey,
    CROWDFUNDING_CONTRACT_ID,
    'withdraw',
    nativeToScVal(campaignId, { type: 'u32' }),
    callerAddr.toScVal(),
  );

  return await signAndSubmit(tx);
}

// ── Claim Refund ─────────────────────────────────────────────────────────────

export async function claimRefund(publicKey, campaignId) {
  if (!CROWDFUNDING_CONTRACT_ID) throw new Error('Crowdfunding contract ID not configured');

  const callerAddr = new Address(publicKey);

  const tx = await buildContractTx(
    publicKey,
    CROWDFUNDING_CONTRACT_ID,
    'refund',
    nativeToScVal(campaignId, { type: 'u32' }),
    callerAddr.toScVal(),
  );

  return await signAndSubmit(tx);
}

// ── Get Campaign ─────────────────────────────────────────────────────────────

export async function getCampaign(publicKey, campaignId) {
  if (!CROWDFUNDING_CONTRACT_ID) return null;

  const sourceAddr = publicKey || '';
  try {
    const sim = await simulateContractCall(
      sourceAddr,
      CROWDFUNDING_CONTRACT_ID,
      'get_campaign',
      nativeToScVal(campaignId, { type: 'u32' }),
    );

    if (sim.result) {
      return parseCampaign(scValToNative(sim.result.retval));
    }
    return null;
  } catch (err) {
    console.warn('Failed to get campaign:', err);
    return null;
  }
}

// ── Get All Campaigns ────────────────────────────────────────────────────────

export async function getAllCampaigns(publicKey) {
  if (!CROWDFUNDING_CONTRACT_ID) return [];
  const sourceAddr = publicKey || '';

  try {
    const sim = await simulateContractCall(
      sourceAddr,
      CROWDFUNDING_CONTRACT_ID,
      'get_all_campaigns',
    );

    if (sim.result) {
      const raw = scValToNative(sim.result.retval);
      if (Array.isArray(raw)) {
        return raw.map(parseCampaign);
      }
    }
    return [];
  } catch (err) {
    console.warn('Failed to get all campaigns:', err);
    return [];
  }
}

// ── Get Contribution ─────────────────────────────────────────────────────────

export async function getContribution(publicKey, campaignId) {
  if (!CROWDFUNDING_CONTRACT_ID || !publicKey) return 0;

  try {
    const funderAddr = new Address(publicKey);
    const sim = await simulateContractCall(
      publicKey,
      CROWDFUNDING_CONTRACT_ID,
      'get_contribution',
      nativeToScVal(campaignId, { type: 'u32' }),
      funderAddr.toScVal(),
    );

    if (sim.result) {
      const raw = scValToNative(sim.result.retval);
      return Number(raw) / 1e7;
    }
    return 0;
  } catch (err) {
    console.warn('Failed to get contribution:', err);
    return 0;
  }
}

// ── Campaign Parser ──────────────────────────────────────────────────────────

function parseStatus(rawStatus) {
  const statusMap = { 0: 'Active', 1: 'Success', 2: 'Failed' };

  // Handle array enum like ["Active"] from scValToNative
  if (Array.isArray(rawStatus)) {
    return parseStatus(rawStatus[0]);
  }

  // Handle numeric enum (0=Active, 1=Success, 2=Failed)
  if (typeof rawStatus === 'number') {
    return statusMap[rawStatus] || 'Active';
  }

  // Handle BigInt
  if (typeof rawStatus === 'bigint') {
    return statusMap[Number(rawStatus)] || 'Active';
  }

  // Handle string — could be "0", "1", "2" or "Active", "Success", "Failed"
  if (typeof rawStatus === 'string') {
    const num = parseInt(rawStatus, 10);
    if (!isNaN(num) && statusMap[num]) {
      return statusMap[num];
    }
    if (['Active', 'Success', 'Failed'].includes(rawStatus)) {
      return rawStatus;
    }
    // Fallback: return the string as-is if it looks like a status name
    const capitalized = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
    if (['Active', 'Success', 'Failed'].includes(capitalized)) {
      return capitalized;
    }
  }

  // Handle Soroban object enum like { Active: undefined }
  if (rawStatus && typeof rawStatus === 'object') {
    const key = Object.keys(rawStatus)[0];
    if (key) return key;
  }

  return 'Active';
}

function parseCampaign(raw) {
  try {
    return {
      id: Number(raw.id ?? 0),
      creator: raw.creator?.toString?.() || String(raw.creator || ''),
      title: raw.title?.toString?.() || String(raw.title || ''),
      description: raw.description?.toString?.() || String(raw.description || ''),
      goal: Number(raw.goal ?? 0) / 1e7,
      raised: Number(raw.raised ?? 0) / 1e7,
      deadline: Number(raw.deadline ?? 0),
      withdrawn: Boolean(raw.withdrawn),
      status: parseStatus(raw.status),
    };
  } catch (err) {
    console.warn('[parseCampaign] Error parsing campaign:', err, raw);
    return {
      id: 0, creator: '', title: 'Parse Error', description: '',
      goal: 0, raised: 0, deadline: 0, withdrawn: false, status: 'Active',
    };
  }
}
