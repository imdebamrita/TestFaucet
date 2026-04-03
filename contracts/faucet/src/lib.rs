#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Vec, Map};

// ── Data Types ───────────────────────────────────────────────────────────────

/// Status of a crowdfunding campaign.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum Status {
    Active,  // Campaign is live and accepting funds
    Success, // Goal was met (raised >= goal)
    Failed,  // Deadline passed without meeting goal
}

/// All data stored per campaign.
#[derive(Clone)]
#[contracttype]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,      // Target amount in token units (7 decimals)
    pub raised: i128,    // Total amount raised so far
    pub deadline: u64,   // Unix timestamp — campaign ends after this
    pub withdrawn: bool, // Whether the creator has withdrawn funds
    pub status: Status,  // Current campaign status
}

/// Storage keys for the contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                       // Address — contract administrator
    TokenId,                     // Address — token used for funding
    CampaignCount,               // u32 — auto-incrementing campaign ID counter
    Campaign(u32),               // Campaign struct for a given campaign_id
    Contribution(u32, Address),  // i128 — how much a funder contributed to a campaign
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundingContract;

#[contractimpl]
impl CrowdfundingContract {
    // ── Initialize ───────────────────────────────────────────────────────

    /// Initialize the crowdfunding platform.
    ///
    /// Must be called once before any other function.
    /// Sets the admin who deployed the contract and the token
    /// that will be used for all campaign funding.
    ///
    /// # Arguments
    /// * `admin`    — the deployer / administrator address
    /// * `token_id` — contract address of the token (e.g. XLM SAC)
    pub fn initialize(env: Env, admin: Address, token_id: Address) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);

        // Keep instance alive for ~30 days (assuming 5-second ledgers)
        env.storage().instance().extend_ttl(518400, 518400);
    }

    // ── Create Campaign ──────────────────────────────────────────────────

    /// Create a new crowdfunding campaign.
    ///
    /// Anyone with a connected wallet can create a campaign.
    /// Returns the unique campaign ID (auto-incremented).
    ///
    /// # Arguments
    /// * `creator`     — address of the campaign owner
    /// * `title`       — short title for the campaign
    /// * `description` — longer description of the project
    /// * `goal`        — funding target in token units (7 decimals)
    /// * `deadline`    — unix timestamp after which the campaign ends
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        goal: i128,
        deadline: u64,
    ) -> u32 {
        creator.require_auth();

        // Validate inputs
        if goal <= 0 {
            panic!("Goal must be positive");
        }
        if deadline <= env.ledger().timestamp() {
            panic!("Deadline must be in the future");
        }

        // Get and increment campaign counter
        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        count += 1;

        let campaign = Campaign {
            id: count,
            creator,
            title,
            description,
            goal,
            raised: 0,
            deadline,
            withdrawn: false,
            status: Status::Active,
        };

        // Store the campaign in persistent storage so it survives long-term
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(count), &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(count), 518400, 518400);

        // Update the global counter
        env.storage()
            .instance()
            .set(&DataKey::CampaignCount, &count);
        env.storage().instance().extend_ttl(518400, 518400);

        count
    }

    // ── Fund ─────────────────────────────────────────────────────────────

    /// Contribute tokens to an active campaign.
    ///
    /// Transfers `amount` tokens from the funder to the contract.
    /// If funding pushes `raised >= goal`, the status flips to Success.
    ///
    /// # Arguments
    /// * `campaign_id` — which campaign to fund
    /// * `funder`      — address sending tokens
    /// * `amount`      — how many tokens to contribute (7 decimals)
    pub fn fund(env: Env, campaign_id: u32, funder: Address, amount: i128) {
        funder.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        // Check campaign is still active and within deadline
        if campaign.status != Status::Active {
            panic!("Campaign is not active");
        }
        if env.ledger().timestamp() >= campaign.deadline {
            panic!("Campaign deadline has passed");
        }

        // Transfer tokens from funder → contract
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&funder, &env.current_contract_address(), &amount);

        // Update campaign raised amount
        campaign.raised += amount;

        // Auto-mark success when goal is met
        if campaign.raised >= campaign.goal {
            campaign.status = Status::Success;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(campaign_id), 518400, 518400);

        // Track individual contribution for potential refunds
        let contrib_key = DataKey::Contribution(campaign_id, funder.clone());
        let existing: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&contrib_key, &(existing + amount));
        env.storage()
            .persistent()
            .extend_ttl(&contrib_key, 518400, 518400);

        env.storage().instance().extend_ttl(518400, 518400);
    }

    // ── Withdraw ─────────────────────────────────────────────────────────

    /// Withdraw funds from a successful campaign.
    ///
    /// Only the campaign creator can call this.
    /// Only works if: goal was met AND deadline has passed AND not yet withdrawn.
    /// Transfers the entire `raised` amount to the creator.
    ///
    /// # Arguments
    /// * `campaign_id` — which campaign to withdraw from
    /// * `caller`      — must be the campaign creator
    pub fn withdraw(env: Env, campaign_id: u32, caller: Address) {
        caller.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        // Only the creator can withdraw
        if campaign.creator != caller {
            panic!("Only the campaign creator can withdraw");
        }

        // Must be successful
        if campaign.status != Status::Success {
            panic!("Campaign goal not met");
        }

        // Deadline must have passed
        if env.ledger().timestamp() < campaign.deadline {
            panic!("Campaign deadline has not passed yet");
        }

        // Cannot double-withdraw
        if campaign.withdrawn {
            panic!("Funds already withdrawn");
        }

        // Transfer raised funds to creator
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &caller, &campaign.raised);

        campaign.withdrawn = true;

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(campaign_id), 518400, 518400);
        env.storage().instance().extend_ttl(518400, 518400);
    }

    // ── Refund ───────────────────────────────────────────────────────────

    /// Claim a refund from a failed campaign.
    ///
    /// Only works if: goal NOT met AND deadline has passed.
    /// Returns the caller's individual contribution back to them.
    ///
    /// # Arguments
    /// * `campaign_id` — which campaign to refund from
    /// * `caller`      — the funder claiming their refund
    pub fn refund(env: Env, campaign_id: u32, caller: Address) {
        caller.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        // Deadline must have passed
        if env.ledger().timestamp() < campaign.deadline {
            panic!("Campaign deadline has not passed yet");
        }

        // If the campaign hit its goal, no refunds allowed
        if campaign.raised >= campaign.goal {
            panic!("Campaign was successful — no refunds");
        }

        // Mark as failed if still active
        if campaign.status == Status::Active {
            campaign.status = Status::Failed;
            env.storage()
                .persistent()
                .set(&DataKey::Campaign(campaign_id), &campaign);
        }

        // Look up how much this caller contributed
        let contrib_key = DataKey::Contribution(campaign_id, caller.clone());
        let contributed: i128 = env
            .storage()
            .persistent()
            .get(&contrib_key)
            .unwrap_or(0);

        if contributed <= 0 {
            panic!("No contribution found for this address");
        }

        // Transfer refund back to the caller
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &caller, &contributed);

        // Zero out their contribution so they can't double-refund
        env.storage().persistent().set(&contrib_key, &0i128);
        env.storage().instance().extend_ttl(518400, 518400);
    }

    // ── Read-Only Queries ────────────────────────────────────────────────

    /// Get full details for a single campaign by ID.
    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found")
    }

    /// Get all campaigns that have been created.
    /// Returns a Vec of Campaign structs.
    pub fn get_all_campaigns(env: Env) -> Vec<Campaign> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);

        let mut campaigns = Vec::new(&env);
        for i in 1..=count {
            if let Some(c) = env
                .storage()
                .persistent()
                .get::<DataKey, Campaign>(&DataKey::Campaign(i))
            {
                campaigns.push_back(c);
            }
        }
        campaigns
    }

    /// Get how much a specific address contributed to a specific campaign.
    pub fn get_contribution(env: Env, campaign_id: u32, funder: Address) -> i128 {
        let key = DataKey::Contribution(campaign_id, funder);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Get the token contract address used for funding.
    pub fn get_token_id(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenId).unwrap()
    }

    /// Get the total number of campaigns created.
    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::{StellarAssetClient, TokenClient},
        Env,
    };

    fn create_token<'a>(env: &'a Env, admin: &'a Address) -> (Address, StellarAssetClient<'a>, TokenClient<'a>) {
        let addr = env.register_stellar_asset_contract_v2(admin.clone()).address();
        (addr.clone(), StellarAssetClient::new(env, &addr), TokenClient::new(env, &addr))
    }

    fn set_time(env: &Env, ts: u64) {
        env.ledger().set(LedgerInfo {
            timestamp: ts,
            protocol_version: 25,
            sequence_number: 100,
            network_id: [0u8; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 100,
            min_persistent_entry_ttl: 100,
            max_entry_ttl: 10_000_000,
        });
    }

    #[test]
    fn test_full_lifecycle_success() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let funder1 = Address::generate(&env);
        let funder2 = Address::generate(&env);

        // Set up token
        let (token_addr, sac, token) = create_token(&env, &admin);

        // Deploy and initialize crowdfunding contract
        let contract_id = env.register(CrowdfundingContract, ());
        let client = CrowdfundingContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_addr);

        // Mint tokens to funders
        sac.mint(&funder1, &500_0000000i128);
        sac.mint(&funder2, &500_0000000i128);

        // Create a campaign: goal = 100 tokens, deadline = timestamp 10000
        set_time(&env, 1000);
        let goal: i128 = 100_0000000; // 100 tokens
        let deadline: u64 = 10_000;
        let title = String::from_str(&env, "Test Project");
        let desc = String::from_str(&env, "A test crowdfunding campaign");
        let campaign_id = client.create_campaign(&creator, &title, &desc, &goal, &deadline);
        assert_eq!(campaign_id, 1);

        // Fund the campaign
        set_time(&env, 2000);
        client.fund(&campaign_id, &funder1, &60_0000000i128);
        client.fund(&campaign_id, &funder2, &50_0000000i128);

        // Check campaign is now successful (raised 110 >= goal 100)
        let campaign = client.get_campaign(&campaign_id);
        assert_eq!(campaign.raised, 110_0000000i128);
        assert_eq!(campaign.status, Status::Success);

        // Creator withdraws after deadline
        set_time(&env, 11_000);
        client.withdraw(&campaign_id, &creator);

        let campaign = client.get_campaign(&campaign_id);
        assert!(campaign.withdrawn);
        assert_eq!(token.balance(&creator), 110_0000000i128);
    }

    #[test]
    fn test_refund_on_failed_campaign() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let funder = Address::generate(&env);

        let (token_addr, sac, token) = create_token(&env, &admin);
        let contract_id = env.register(CrowdfundingContract, ());
        let client = CrowdfundingContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_addr);

        sac.mint(&funder, &500_0000000i128);

        // Create campaign: goal = 200 tokens, deadline = 10000
        set_time(&env, 1000);
        let campaign_id = client.create_campaign(
            &creator,
            &String::from_str(&env, "Will Fail"),
            &String::from_str(&env, "Not enough funding"),
            &200_0000000i128,
            &10_000u64,
        );

        // Fund only 50 tokens (not enough)
        set_time(&env, 2000);
        client.fund(&campaign_id, &funder, &50_0000000i128);
        assert_eq!(token.balance(&funder), 450_0000000i128);

        // After deadline, claim refund
        set_time(&env, 11_000);
        client.refund(&campaign_id, &funder);

        // Funder should have their tokens back
        assert_eq!(token.balance(&funder), 500_0000000i128);

        let campaign = client.get_campaign(&campaign_id);
        assert_eq!(campaign.status, Status::Failed);
    }

    #[test]
    fn test_get_all_campaigns() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);

        let (token_addr, _, _) = create_token(&env, &admin);
        let contract_id = env.register(CrowdfundingContract, ());
        let client = CrowdfundingContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_addr);

        set_time(&env, 1000);

        // Create 3 campaigns
        for _i in 0..3 {
            client.create_campaign(
                &creator,
                &String::from_str(&env, "Campaign"),
                &String::from_str(&env, "Description"),
                &100_0000000i128,
                &10_000u64,
            );
        }

        let all = client.get_all_campaigns();
        assert_eq!(all.len(), 3);
        assert_eq!(client.get_campaign_count(), 3);
    }

    #[test]
    #[should_panic(expected = "Only the campaign creator can withdraw")]
    fn test_non_creator_cannot_withdraw() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let attacker = Address::generate(&env);
        let funder = Address::generate(&env);

        let (token_addr, sac, _) = create_token(&env, &admin);
        let contract_id = env.register(CrowdfundingContract, ());
        let client = CrowdfundingContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token_addr);

        sac.mint(&funder, &500_0000000i128);

        set_time(&env, 1000);
        let cid = client.create_campaign(
            &creator,
            &String::from_str(&env, "Secure"),
            &String::from_str(&env, "Only creator withdraws"),
            &50_0000000i128,
            &10_000u64,
        );

        set_time(&env, 2000);
        client.fund(&cid, &funder, &60_0000000i128);

        set_time(&env, 11_000);
        // Attacker tries to withdraw — should panic
        client.withdraw(&cid, &attacker);
    }
}
