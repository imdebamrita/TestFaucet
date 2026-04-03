# 🚀 StellarCrowdfund — Decentralized Crowdfunding on Stellar

A premium, full-stack crowdfunding platform built on the **Stellar Network** using **Soroban Smart Contracts**. Create campaigns, fund projects, and manage the entire crowdfunding lifecycle — fully on-chain.

![Stellar Crowdfunding](screenshot/Dashboard.png)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏗️ **Create Campaigns** | Define titles, descriptions, funding goals, and deadlines |
| 💎 **Fund Projects** | Contribute tokens to active campaigns via Freighter wallet |
| 📊 **Real-time Tracking** | Live progress bars, countdown timers, and funding stats |
| 🔐 **Safe Withdrawals** | Creators can only withdraw if the campaign meets its goal |
| 💸 **Automatic Refunds** | Backers can claim full refunds if a campaign fails |
| 🔗 **Auto Trustline** | Automatically sets up token trustlines before first funding |
| 🎨 **Premium UI** | Glassmorphic dark theme with smooth animations |
| 📱 **Responsive** | Works on desktop, tablet, and mobile |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Rust, Soroban SDK |
| **Frontend** | React 18 (Vite) |
| **Blockchain SDK** | `@stellar/stellar-sdk` v13 |
| **Wallet** | `@stellar/freighter-api` v6 |
| **Styling** | Vanilla CSS, HSL design tokens, Glassmorphism |
| **Network** | Stellar Testnet (Soroban RPC) |

---

## 📂 Project Structure

```
TestFaucet/
├── contracts/
│   └── faucet/src/lib.rs     # Soroban smart contract (Rust)
├── frontend/
│   ├── src/
│   │   ├── components/       # Navbar, CampaignCard, FundModal, Toast
│   │   ├── hooks/            # useWallet, useToast
│   │   ├── lib/              # stellar.js (SDK), contract.js (contract calls)
│   │   ├── pages/            # HomePage, CampaignDetailPage, CreateCampaignPage, MyActivityPage
│   │   ├── styles/           # Global CSS design system
│   │   └── App.jsx           # Main application router
│   └── .env                  # Contract IDs & network config
├── scripts/
│   ├── deploy.sh             # Full deployment automation
│   └── build.sh              # Contract build script
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools) installed and configured
- [Rust](https://www.rust-lang.org/) with `wasm32-unknown-unknown` target
- [Node.js](https://nodejs.org/) v18+ & npm
- [Freighter Wallet](https://www.freighter.app/) browser extension (set to **Testnet**)

### 1. Clone & Deploy Contracts

```bash
git clone <your-repo-url>
cd TestFaucet

# Deploy token + crowdfunding contracts to Stellar Testnet
bash scripts/deploy.sh
```

This will:
- Build the Soroban smart contract
- Deploy a token contract and the crowdfunding contract
- Generate the frontend `.env` file with contract IDs

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at **http://localhost:3000**

### 3. Mint Test Tokens

Before users can fund campaigns, they need **FUND** tokens. The token trustline is automatically created by the frontend when a user first tries to fund a campaign.

Mint tokens to a wallet using the CLI:

**Windows (PowerShell):**
```powershell
stellar contract invoke --id CBCSQZIQHWUF6Z2LZPYA6QIYEFUUT7FF7DWEVOQBE2HNOTONMHVYPJ3L --source-account crowdfund-deployer --network testnet -- mint --to <USER_WALLET_ADDRESS> --amount 10000000000
```

**Linux / macOS:**
```bash
stellar contract invoke \
  --id CBCSQZIQHWUF6Z2LZPYA6QIYEFUUT7FF7DWEVOQBE2HNOTONMHVYPJ3L \
  --source-account crowdfund-deployer \
  --network testnet \
  -- mint \
  --to <USER_WALLET_ADDRESS> \
  --amount 10000000000
```

> **Note:** `10000000000` = 1,000 tokens (7 decimal places). The `crowdfund-deployer` account is the token admin.

### 4. Use the Platform

1. Open **http://localhost:3000**
2. Click **Connect Wallet** → Freighter will prompt for access
3. Ensure Freighter is set to **Testnet**
4. **Create** a campaign with title, description, goal, and deadline
5. **Fund** campaigns using the 💎 Fund button
6. **Withdraw** funds (if you're the creator and the goal was met)
7. **Refund** your contribution (if the campaign failed)

---

## 📜 Smart Contract API

### Write Functions (require signing)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `create_campaign` | `creator, title, description, goal, deadline` | Launch a new crowdfunding campaign |
| `fund` | `campaign_id, funder, amount` | Contribute tokens to a campaign |
| `withdraw` | `campaign_id, caller` | Creator withdraws funds (goal must be met) |
| `refund` | `campaign_id, caller` | Backer reclaims funds (campaign must have failed) |

### Read Functions (simulation only)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `get_campaign` | `campaign_id` | Get details of a single campaign |
| `get_all_campaigns` | — | List all campaigns on-chain |
| `get_contribution` | `campaign_id, funder` | Check a user's contribution to a campaign |

### Campaign Status Lifecycle

```
Active  →  Success (goal met & deadline passed)  →  Withdrawn
   ↓
Failed (deadline passed & goal not met)  →  Refunded
```

---

## 🔧 Environment Variables

Create a `.env` file in `frontend/` (auto-generated by `deploy.sh`):

```env
VITE_CROWDFUNDING_CONTRACT_ID=CCMOLJSQ7HWPYS62TRXJPKDJZ5SC6REY2EDVCYYPLVI2YLZGXFKDPJYH
VITE_TOKEN_CONTRACT_ID=CBCSQZIQHWUF6Z2LZPYA6QIYEFUUT7FF7DWEVOQBE2HNOTONMHVYPJ3L
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
```

| Variable | Description |
|----------|-------------|
| `VITE_CROWDFUNDING_CONTRACT_ID` | Deployed crowdfunding smart contract address |
| `VITE_TOKEN_CONTRACT_ID` | FUND token contract (SAC) address |
| `VITE_NETWORK_PASSPHRASE` | Stellar network passphrase (Testnet) |
| `VITE_RPC_URL` | Soroban RPC endpoint |

---

## 🏗️ Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Freighter   │◄───►│   React App     │◄───►│  Soroban RPC     │
│   Wallet      │     │   (Vite)        │     │  (Testnet)       │
└──────────────┘     ├─────────────────┤     ├──────────────────┤
                     │ • stellar.js    │     │ • Crowdfunding   │
                     │   (SDK wrapper) │     │   Contract       │
                     │ • contract.js   │     │ • Token Contract │
                     │   (contract API)│     │   (SAC)          │
                     └─────────────────┘     └──────────────────┘
```

**Key Design Decisions:**
- **Raw JSON-RPC** for `sendTransaction` and `getTransaction` to avoid SDK v13 XDR parsing issues with Soroban envelope types
- **Auto trustline setup** — detects missing trustlines and creates them via Freighter before funding
- **`server.prepareTransaction()`** for contract call assembly (simulation + assembly in one step)
- **Read-only simulations** use `Keypair.random()` to avoid needing a funded account

---

## 📸 Screenshots

| Home Page | Campaign Grid | Stellar |
|-----------|--------------|---------|
| ![Home](screenshot/Dashboard.png) | ![Campaigns](screenshot/Dashboard_2.png) | ![Stellar](screenshot/Stellar.png) |

---

## 🔗 Resources

- **[Crowdfund Contract Explorer](https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=CCMOLJSQ7HWPYS62TRXJPKDJZ5SC6REY2EDVCYYPLVI2YLZGXFKDPJYH;;)**: Interact with the core Crowdfunding contract on-chain.
- **[FUND Token Explorer](https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=CBCSQZIQHWUF6Z2LZPYA6QIYEFUUT7FF7DWEVOQBE2HNOTONMHVYPJ3L;;)**: Interact with the FUND token contract directly via the official Stellar Lab.

---

## 📄 License

Built with ❤️ for the Stellar Ecosystem.
