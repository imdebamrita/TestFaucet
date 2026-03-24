import { rpc, Networks, Contract, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';

// ── Network Configuration ────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org';

// ── RPC Server ───────────────────────────────────────────────────────────────

export const server = new rpc.Server(RPC_URL, {
  allowHttp: true,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Soroban transaction for contract invocation.
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

  // Simulate to get resource estimates
  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation error: ${simulated.error}`);
  }

  // Assemble with proper resource footprint
  const assembled = rpc.assembleTransaction(tx, simulated).build();
  return assembled;
}

/**
 * Submit a signed transaction XDR and wait for result.
 */
export async function submitTx(signedXdr) {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await server.sendTransaction(tx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${result.errorResult}`);
  }

  // Poll for completion
  const hash = result.hash;
  let getResult;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(hash);
    if (getResult.status !== 'NOT_FOUND') {
      break;
    }
  }

  if (!getResult || getResult.status === 'NOT_FOUND') {
    throw new Error('Transaction not found after polling. It may still be processing.');
  }

  if (getResult.status === 'FAILED') {
    throw new Error('Transaction failed on-chain.');
  }

  return getResult;
}

/**
 * Simulate a read-only contract call (no signing needed).
 */
export async function simulateContractCall(sourcePublicKey, contractId, method, ...args) {
  const account = await server.getAccount(sourcePublicKey);
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
