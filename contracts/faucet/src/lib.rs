#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    TokenId,
    ClaimAmount,
    Cooldown,
    LastClaim(Address),
}

// ── Error Codes ───────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum FaucetError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CooldownNotMet = 3,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct FaucetContract;

#[contractimpl]
impl FaucetContract {
    /// Initialize the faucet contract.
    ///
    /// # Arguments
    /// * `admin` - The admin address that controls the faucet
    /// * `token_id` - The contract address of the token to distribute
    /// * `claim_amount` - Amount of tokens to distribute per claim
    /// * `cooldown` - Cooldown period in seconds between claims (e.g. 86400 for 24h)
    pub fn initialize(
        env: Env,
        admin: Address,
        token_id: Address,
        claim_amount: i128,
        cooldown: u64,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::ClaimAmount, &claim_amount);
        env.storage().instance().set(&DataKey::Cooldown, &cooldown);

        // Extend instance TTL to ~30 days (assuming 5s ledgers)
        env.storage().instance().extend_ttl(518400, 518400);
    }

    /// Claim tokens from the faucet.
    ///
    /// Each address can claim once per cooldown period.
    /// Tokens are transferred from the faucet contract to the caller.
    pub fn claim(env: Env, user: Address) {
        user.require_auth();

        // Ensure contract is initialized
        if !env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract not initialized");
        }

        let cooldown: u64 = env.storage().instance().get(&DataKey::Cooldown).unwrap();
        let now = env.ledger().timestamp();

        // Check cooldown
        let last_claim_key = DataKey::LastClaim(user.clone());
        if let Some(last_time) = env.storage().persistent().get::<DataKey, u64>(&last_claim_key) {
            if now < last_time + cooldown {
                panic!("Cooldown period not met. Please wait before claiming again.");
            }
        }

        // Get token info
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let claim_amount: i128 = env.storage().instance().get(&DataKey::ClaimAmount).unwrap();

        // Transfer tokens from faucet to user
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &user, &claim_amount);

        // Update last claim timestamp
        env.storage().persistent().set(&last_claim_key, &now);

        // Extend persistent entry TTL to ~30 days
        env.storage().persistent().extend_ttl(&last_claim_key, 518400, 518400);

        // Extend instance TTL
        env.storage().instance().extend_ttl(518400, 518400);
    }

    /// Query the last claim timestamp for a given address.
    /// Returns 0 if the address has never claimed.
    pub fn get_last_claim(env: Env, user: Address) -> u64 {
        let key = DataKey::LastClaim(user);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Query the configured claim amount.
    pub fn get_claim_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::ClaimAmount)
            .unwrap_or(0)
    }

    /// Query the configured cooldown period (in seconds).
    pub fn get_cooldown(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::Cooldown)
            .unwrap_or(0)
    }

    /// Query the token contract address.
    pub fn get_token_id(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenId).unwrap()
    }

    /// Get the faucet's own token balance.
    pub fn get_faucet_balance(env: Env) -> i128 {
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        token_client.balance(&env.current_contract_address())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::{StellarAssetClient, TokenClient},
        Env,
    };

    fn create_token_contract<'a>(env: &'a Env, admin: &'a Address) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
        let token_addr = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let sac_client = StellarAssetClient::new(env, &token_addr);
        let token_client = TokenClient::new(env, &token_addr);
        (token_addr, sac_client, token_client)
    }

    fn setup_ledger(env: &Env, timestamp: u64) {
        env.ledger().set(LedgerInfo {
            timestamp,
            protocol_version: 25,
            sequence_number: 100,
            network_id: [0u8; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 100,
            min_persistent_entry_ttl: 100,
            max_entry_ttl: 10000000,
        });
    }

    #[test]
    fn test_initialize_and_claim() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        // Create token and faucet contracts
        let (token_addr, sac_client, token_client) = create_token_contract(&env, &admin);
        let faucet_id = env.register(FaucetContract, ());
        let faucet_client = FaucetContractClient::new(&env, &faucet_id);

        // Initialize faucet: 100 tokens, 86400s (24h) cooldown
        let claim_amount: i128 = 100_0000000; // 100 tokens with 7 decimals
        let cooldown: u64 = 86400;
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);

        // Mint tokens to faucet contract
        sac_client.mint(&faucet_id, &(1000_0000000i128));

        // Set ledger timestamp
        setup_ledger(&env, 1000);

        // User claims tokens
        faucet_client.claim(&user);

        // Verify user balance
        assert_eq!(token_client.balance(&user), claim_amount);

        // Verify faucet balance decreased
        assert_eq!(token_client.balance(&faucet_id), 1000_0000000 - claim_amount);

        // Verify last claim timestamp
        assert_eq!(faucet_client.get_last_claim(&user), 1000);
    }

    #[test]
    #[should_panic(expected = "Cooldown period not met")]
    fn test_double_claim_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_addr, sac_client, _) = create_token_contract(&env, &admin);
        let faucet_id = env.register(FaucetContract, ());
        let faucet_client = FaucetContractClient::new(&env, &faucet_id);

        let claim_amount: i128 = 100_0000000;
        let cooldown: u64 = 86400;
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);

        sac_client.mint(&faucet_id, &(1000_0000000i128));

        setup_ledger(&env, 1000);
        faucet_client.claim(&user);

        // Try claiming again immediately — should panic
        setup_ledger(&env, 1500);
        faucet_client.claim(&user);
    }

    #[test]
    fn test_claim_after_cooldown() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_addr, sac_client, token_client) = create_token_contract(&env, &admin);
        let faucet_id = env.register(FaucetContract, ());
        let faucet_client = FaucetContractClient::new(&env, &faucet_id);

        let claim_amount: i128 = 100_0000000;
        let cooldown: u64 = 86400;
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);

        sac_client.mint(&faucet_id, &(1000_0000000i128));

        // First claim
        setup_ledger(&env, 1000);
        faucet_client.claim(&user);
        assert_eq!(token_client.balance(&user), claim_amount);

        // Advance past cooldown and claim again
        setup_ledger(&env, 1000 + 86400 + 1);
        faucet_client.claim(&user);
        assert_eq!(token_client.balance(&user), claim_amount * 2);
    }

    #[test]
    fn test_query_functions() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        let (token_addr, _, _) = create_token_contract(&env, &admin);
        let faucet_id = env.register(FaucetContract, ());
        let faucet_client = FaucetContractClient::new(&env, &faucet_id);

        let claim_amount: i128 = 100_0000000;
        let cooldown: u64 = 86400;
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);

        assert_eq!(faucet_client.get_claim_amount(), claim_amount);
        assert_eq!(faucet_client.get_cooldown(), cooldown);

        // Unclaimed user should return 0
        let user = Address::generate(&env);
        assert_eq!(faucet_client.get_last_claim(&user), 0);
    }

    #[test]
    #[should_panic(expected = "Contract already initialized")]
    fn test_double_initialize_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        let (token_addr, _, _) = create_token_contract(&env, &admin);
        let faucet_id = env.register(FaucetContract, ());
        let faucet_client = FaucetContractClient::new(&env, &faucet_id);

        let claim_amount: i128 = 100_0000000;
        let cooldown: u64 = 86400;
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);

        // Try to initialize again — should panic
        faucet_client.initialize(&admin, &token_addr, &claim_amount, &cooldown);
    }
}
