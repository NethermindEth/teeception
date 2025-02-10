/// @title Agent Contract
/// @notice Represents an AI agent that can process prompts for payment
/// @dev Implements prompt payment, consumption, and reward distribution
use core::starknet::ContractAddress;

/// @notice Represents a prompt's state
#[derive(Default, Drop, Copy, PartialEq, Serde, starknet::Store)]
pub enum PromptState {
    /// @notice Prompt is unknown
    #[default]
    Unknown,
    /// @notice Prompt has been submitted by <user> at <timestamp>
    Submitted: (ContractAddress, u64),
    /// @notice Prompt has been consumed
    Consumed,
    /// @notice Prompt has been reclaimed
    Reclaimed,
}

/// @notice Interface for interacting with Agent contracts
/// @dev Handles prompt lifecycle, token transfers, and agent configuration
#[starknet::interface]
pub trait IAgent<TContractState> {
    /// @notice Pay for a new prompt to be processed
    /// @param tweet_id ID of tweet to process
    /// @param prompt The prompt text
    /// @return The unique ID assigned to this prompt
    /// @dev Requires token approval first. Example:
    /// ```
    /// let prompt_id = agent.pay_for_prompt(12345, "analyze this tweet");
    /// ```
    fn pay_for_prompt(ref self: TContractState, tweet_id: u64, prompt: ByteArray) -> u64;

    /// @notice Reclaim tokens for an unprocessed prompt after delay period
    /// @param prompt_id ID of prompt to reclaim
    /// @dev Can only be called after RECLAIM_DELAY has passed. Example:
    /// ```
    /// // After RECLAIM_DELAY has passed
    /// agent.reclaim_prompt(prompt_id);
    /// ```
    fn reclaim_prompt(ref self: TContractState, prompt_id: u64);

    /// @notice Process a prompt and distribute rewards
    /// @param prompt_id ID of prompt to consume
    /// @param drain_to Address to send agent's share to
    /// @dev Only callable by registry. Example:
    /// ```
    /// registry.consume_prompt(agent_address, prompt_id, recipient);
    /// ```
    fn consume_prompt(ref self: TContractState, prompt_id: u64, drain_to: ContractAddress);

    /// @notice Withdraw remaining tokens after agent is finalized
    /// @dev Only callable by creator after end_time or when drained. Example:
    /// ```
    /// // After end_time has passed or agent is drained
    /// agent.withdraw();
    /// ```
    fn withdraw(ref self: TContractState);

    /// @notice Get the system prompt that defines agent behavior
    /// @return The agent's system prompt text
    fn get_system_prompt(self: @TContractState) -> ByteArray;

    /// @notice Get the agent's unique name
    /// @return The agent's name
    fn get_name(self: @TContractState) -> ByteArray;

    /// @notice Get address that created this agent
    /// @return The creator's address
    fn get_creator(self: @TContractState) -> ContractAddress;

    /// @notice Get price per prompt in token units
    /// @return The price per prompt
    fn get_prompt_price(self: @TContractState) -> u256;

    /// @notice Get total tokens available as rewards
    /// @return The total prize pool amount
    fn get_prize_pool(self: @TContractState) -> u256;

    /// @notice Get total tokens locked in pending prompts
    /// @return The total pending pool amount
    fn get_pending_pool(self: @TContractState) -> u256;

    /// @notice Get token used for payments
    /// @return The token contract address
    fn get_token(self: @TContractState) -> ContractAddress;

    /// @notice Get registry contract address
    /// @return The registry contract address
    fn get_registry(self: @TContractState) -> ContractAddress;

    /// @notice Get next prompt ID to be assigned
    /// @return The next prompt ID
    fn get_next_prompt_id(self: @TContractState) -> u64;

    /// @notice Get total number of prompts created
    /// @return The total prompt count
    fn get_prompt_count(self: @TContractState) -> u64;

    /// @notice Get timestamp after which no new prompts accepted
    /// @return The end timestamp
    fn get_end_time(self: @TContractState) -> u64;

    /// @notice Check if agent has been drained
    /// @return True if agent has been drained
    fn get_is_drained(self: @TContractState) -> bool;

    /// @notice Get prompt ID at index for user/tweet combination
    /// @param user User address to query
    /// @param tweet_id Tweet ID to query
    /// @param idx Index in the user's prompts for this tweet
    /// @return The prompt ID at the specified index
    fn get_user_tweet_prompt(
        self: @TContractState, user: ContractAddress, tweet_id: u64, idx: u64,
    ) -> u64;

    /// @notice Get number of prompts for user/tweet combination
    /// @param user User address to query
    /// @param tweet_id Tweet ID to query
    /// @return The number of prompts
    fn get_user_tweet_prompts_count(
        self: @TContractState, user: ContractAddress, tweet_id: u64,
    ) -> u64;

    /// @notice Get range of prompt IDs for user/tweet combination
    /// @param user User address to query
    /// @param tweet_id Tweet ID to query
    /// @param start Start index
    /// @param end End index (exclusive)
    /// @return Array of prompt IDs
    fn get_user_tweet_prompts(
        self: @TContractState, user: ContractAddress, tweet_id: u64, start: u64, end: u64,
    ) -> Array<u64>;

    /// @notice Gets a prompt's state
    /// @param prompt_id ID of prompt to check
    /// @return The prompt's state
    fn get_prompt_state(self: @TContractState, prompt_id: u64) -> PromptState;

    /// @notice Gets a prompt's submitter
    /// @param prompt_id ID of prompt to check
    /// @return The prompt's submitter
    fn get_pending_prompt_submitter(self: @TContractState, prompt_id: u64) -> ContractAddress;

    /// @notice Check if agent is no longer accepting prompts
    /// @return True if agent is finalized
    fn is_finalized(self: @TContractState) -> bool;

    /// @notice Get delay before prompts can be reclaimed
    /// @return The reclaim delay in seconds
    fn RECLAIM_DELAY(self: @TContractState) -> u64;

    /// @notice Get basis points for agent's reward share
    /// @return The agent's reward share in basis points
    fn PROMPT_REWARD_BPS(self: @TContractState) -> u16;

    /// @notice Get basis points for creator's fee share
    /// @return The creator's fee share in basis points
    fn CREATOR_REWARD_BPS(self: @TContractState) -> u16;

    /// @notice Get basis points for protocol fee share
    /// @return The protocol fee share in basis points
    fn PROTOCOL_FEE_BPS(self: @TContractState) -> u16;

    /// @notice Get basis points denominator (10000)
    /// @return The basis points denominator
    fn BPS_DENOMINATOR(self: @TContractState) -> u16;
}

/// @title Agent Implementation
/// @notice Implements core agent functionality for prompt processing and reward distribution
/// @dev Handles token transfers, prompt lifecycle, and access control
#[starknet::contract]
pub mod Agent {
    use core::starknet::storage::Map;
    use core::starknet::storage::StoragePathEntry;
    use core::starknet::storage::StoragePointerReadAccess;
    use core::starknet::storage::StoragePointerWriteAccess;
    use core::starknet::storage::StorageMapReadAccess;
    use core::starknet::storage::StorageMapWriteAccess;
    use core::starknet::storage::Vec;
    use core::starknet::storage::VecTrait;
    use core::starknet::storage::MutableVecTrait;

    use core::starknet::ContractAddress;
    use core::starknet::get_caller_address;
    use core::starknet::get_contract_address;
    use core::starknet::get_block_timestamp;
    use core::starknet::contract_address_const;

    use openzeppelin::token::erc20::interface::IERC20Dispatcher;
    use openzeppelin::token::erc20::interface::IERC20DispatcherTrait;

    use openzeppelin::security::pausable::PausableComponent;
    use openzeppelin::security::interface::IPausableDispatcher;
    use openzeppelin::security::interface::IPausableDispatcherTrait;

    use super::PromptState;

    /// @notice Reward share for agent (70%)
    const PROMPT_REWARD_BPS: u16 = 7000;
    /// @notice Fee share for creator (20%)
    const CREATOR_REWARD_BPS: u16 = 2000;
    /// @notice Fee share for protocol (10%)
    const PROTOCOL_FEE_BPS: u16 = 1000;
    /// @notice Basis points denominator (100%)
    const BPS_DENOMINATOR: u16 = 10000;
    /// @notice Delay before prompts can be reclaimed (30 minutes)
    const RECLAIM_DELAY: u64 = 1800;

    /// @notice Events emitted by the contract
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        /// @notice Emitted when a prompt is paid for
        PromptPaid: PromptPaid,
        /// @notice Emitted when a prompt is consumed
        PromptConsumed: PromptConsumed,
        /// @notice Emitted when a prompt is reclaimed
        PromptReclaimed: PromptReclaimed,
    }

    /// @notice Emitted when a prompt is paid for
    /// @dev Contains details about the prompt payment and user
    #[derive(Drop, starknet::Event)]
    pub struct PromptPaid {
        /// @notice Address that paid for prompt
        #[key]
        pub user: ContractAddress,
        /// @notice Unique ID assigned to prompt
        #[key]
        pub prompt_id: u64,
        /// @notice ID of tweet to process
        #[key]
        pub tweet_id: u64,
        /// @notice The prompt text
        pub prompt: ByteArray,
    }

    /// @notice Emitted when a prompt is consumed
    /// @dev Contains details about reward distribution
    #[derive(Drop, starknet::Event)]
    pub struct PromptConsumed {
        /// @notice ID of consumed prompt
        #[key]
        pub prompt_id: u64,
        /// @notice Amount sent to agent
        pub amount: u256,
        /// @notice Amount sent to creator
        pub creator_fee: u256,
        /// @notice Amount sent to protocol
        pub protocol_fee: u256,
        /// @notice Address that received agent's share
        pub drained_to: ContractAddress,
    }

    /// @notice Emitted when a prompt is reclaimed
    /// @dev Contains details about the reclaimed prompt
    #[derive(Drop, starknet::Event)]
    pub struct PromptReclaimed {
        /// @notice ID of reclaimed prompt
        #[key]
        pub prompt_id: u64,
        /// @notice Amount refunded
        pub amount: u256,
        /// @notice Address that reclaimed
        pub reclaimer: ContractAddress,
    }

    /// @notice Contract storage
    #[storage]
    struct Storage {
        /// @notice Registry contract address
        registry: ContractAddress,
        /// @notice System prompt defining agent behavior
        system_prompt: ByteArray,
        /// @notice Unique agent name
        name: ByteArray,
        /// @notice Token used for payments
        token: ContractAddress,
        /// @notice Price per prompt in token units
        prompt_price: u256,
        /// @notice Total tokens locked in pending prompts
        pending_pool: u256,
        /// @notice Address that created this agent
        creator: ContractAddress,
        /// @notice Mapping of prompt ID to prompt state
        prompt_states: Map::<u64, PromptState>,
        /// @notice Mapping of user/tweet to prompt IDs
        user_tweet_prompts: Map::<ContractAddress, Map<u64, Vec<u64>>>,
        /// @notice Next prompt ID to be assigned
        next_prompt_id: u64,
        /// @notice Timestamp after which no new prompts accepted
        end_time: u64,
        /// @notice Whether agent has been drained
        is_drained: bool,
    }

    /// @notice Contract constructor
    /// @param name Unique name for the agent
    /// @param registry Registry contract address
    /// @param system_prompt Base prompt defining agent behavior
    /// @param token Token used for payments
    /// @param prompt_price Price per prompt in token units
    /// @param creator Address that created this agent
    /// @param end_time Timestamp when agent stops accepting prompts
    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        registry: ContractAddress,
        system_prompt: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        creator: ContractAddress,
        end_time: u64,
    ) {
        self.registry.write(registry);
        self.name.write(name);
        self.system_prompt.write(system_prompt);
        self.token.write(token);
        self.prompt_price.write(prompt_price);
        self.creator.write(creator);
        self.next_prompt_id.write(1_u64);
        self.end_time.write(end_time);
    }

    /// @notice Implementation of the IAgent interface
    /// @dev Inherits from IAgent trait to provide core agent functionality
    #[abi(embed_v0)]
    impl AgentImpl of super::IAgent<ContractState> {
        /// @inheritdoc IAgent
        fn get_name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        /// @inheritdoc IAgent
        fn get_system_prompt(self: @ContractState) -> ByteArray {
            self.system_prompt.read()
        }

        /// @inheritdoc IAgent
        fn get_prompt_price(self: @ContractState) -> u256 {
            self.prompt_price.read()
        }

        /// @inheritdoc IAgent
        fn get_prize_pool(self: @ContractState) -> u256 {
            self._get_prize_pool(IERC20Dispatcher { contract_address: self.token.read() })
        }

        /// @inheritdoc IAgent
        fn get_pending_pool(self: @ContractState) -> u256 {
            self.pending_pool.read()
        }

        /// @inheritdoc IAgent
        fn get_creator(self: @ContractState) -> ContractAddress {
            self.creator.read()
        }

        /// @inheritdoc IAgent
        fn get_token(self: @ContractState) -> ContractAddress {
            self.token.read()
        }

        /// @inheritdoc IAgent
        fn get_registry(self: @ContractState) -> ContractAddress {
            self.registry.read()
        }

        /// @inheritdoc IAgent
        fn get_next_prompt_id(self: @ContractState) -> u64 {
            self.next_prompt_id.read()
        }

        /// @inheritdoc IAgent
        fn get_prompt_state(self: @ContractState, prompt_id: u64) -> PromptState {
            self.prompt_states.read(prompt_id)
        }

        /// @inheritdoc IAgent
        fn get_pending_prompt_submitter(self: @ContractState, prompt_id: u64) -> ContractAddress {
            if let PromptState::Submitted((submitter, _)) = self.prompt_states.read(prompt_id) {
                submitter
            } else {
                contract_address_const::<0>()
            }
        }

        /// @inheritdoc IAgent
        fn get_prompt_count(self: @ContractState) -> u64 {
            self.next_prompt_id.read() - 1
        }

        /// @inheritdoc IAgent
        fn get_user_tweet_prompt(
            self: @ContractState, user: ContractAddress, tweet_id: u64, idx: u64,
        ) -> u64 {
            let vec = self.user_tweet_prompts.entry(user).entry(tweet_id);
            vec.at(idx).read()
        }

        /// @inheritdoc IAgent
        fn get_user_tweet_prompts_count(
            self: @ContractState, user: ContractAddress, tweet_id: u64,
        ) -> u64 {
            self.user_tweet_prompts.entry(user).entry(tweet_id).len()
        }

        /// @inheritdoc IAgent
        fn get_user_tweet_prompts(
            self: @ContractState, user: ContractAddress, tweet_id: u64, start: u64, mut end: u64,
        ) -> Array<u64> {
            let vec = self.user_tweet_prompts.entry(user).entry(tweet_id);
            let vec_len = vec.len();

            assert(start < end, 'Invalid range');

            if end > vec_len {
                end = vec_len;
            }

            let mut prompts = array![];

            for i in start..end {
                prompts.append(vec.at(i).read());
            };

            prompts
        }

        /// @inheritdoc IAgent
        fn get_end_time(self: @ContractState) -> u64 {
            self.end_time.read()
        }

        /// @inheritdoc IAgent
        fn get_is_drained(self: @ContractState) -> bool {
            self.is_drained.read()
        }

        /// @inheritdoc IAgent
        fn is_finalized(self: @ContractState) -> bool {
            self.end_time.read() < get_block_timestamp() || self.is_drained.read()
        }

        /// @inheritdoc IAgent
        fn withdraw(ref self: ContractState) {
            let caller = get_caller_address();
            assert(caller == self.creator.read(), 'Only creator can withdraw');

            self._assert_finalized();

            self._drain(caller);
        }

        /// @inheritdoc IAgent
        fn pay_for_prompt(ref self: ContractState, tweet_id: u64, prompt: ByteArray) -> u64 {
            self._assert_not_finalized();
            self._assert_registry_not_paused();

            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prompt_price = self.prompt_price.read();

            // Transfer tokens to this contract
            token.transfer_from(caller, get_contract_address(), prompt_price);

            self._increment_pending_pool(prompt_price);

            // Generate unique prompt ID
            let prompt_id = self.next_prompt_id.read();
            self.next_prompt_id.write(prompt_id + 1);

            self
                .prompt_states
                .write(prompt_id, PromptState::Submitted((caller, get_block_timestamp())));
            self.user_tweet_prompts.entry(caller).entry(tweet_id).append().write(prompt_id);

            self.emit(Event::PromptPaid(PromptPaid { user: caller, prompt_id, tweet_id, prompt }));

            prompt_id
        }

        /// @inheritdoc IAgent
        fn reclaim_prompt(ref self: ContractState, prompt_id: u64) {
            let prompt_state = self.prompt_states.read(prompt_id);
            let amount = self.prompt_price.read();
            let caller = get_caller_address();

            self.prompt_states.write(prompt_id, PromptState::Reclaimed);
            self
                .emit(
                    Event::PromptReclaimed(
                        PromptReclaimed { prompt_id, amount, reclaimer: caller },
                    ),
                );

            if let PromptState::Submitted((submitter, timestamp)) = prompt_state {
                assert(get_block_timestamp() >= timestamp + RECLAIM_DELAY, 'Too early to reclaim');

                let token = IERC20Dispatcher { contract_address: self.token.read() };
                token.transfer(submitter, amount);
            } else {
                assert(false, 'Prompt not submitted');
            }
        }

        /// @inheritdoc IAgent
        fn consume_prompt(ref self: ContractState, prompt_id: u64, drain_to: ContractAddress) {
            self._assert_caller_is_registry();
            self._assert_not_finalized();

            if let PromptState::Submitted(_) = self
                .prompt_states
                .read(prompt_id) {} else {
                    assert(false, 'Prompt not in SUBMITTED state');
                }

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let amount = self.prompt_price.read();

            // Calculate fee splits
            let (agent_amount, creator_fee, protocol_fee) = self._split_amounts(amount);

            // Clear pending prompt
            self.prompt_states.write(prompt_id, PromptState::Consumed);

            self
                .emit(
                    Event::PromptConsumed(
                        PromptConsumed {
                            prompt_id,
                            amount: agent_amount,
                            creator_fee,
                            protocol_fee,
                            drained_to: drain_to,
                        },
                    ),
                );

            // Transfer fees
            token.transfer(self.creator.read(), creator_fee);
            token.transfer(self.registry.read(), protocol_fee);

            self._decrement_pending_pool(amount);

            if drain_to != get_contract_address() {
                self._drain(drain_to);
            }
        }

        /// @inheritdoc IAgent
        fn RECLAIM_DELAY(self: @ContractState) -> u64 {
            RECLAIM_DELAY
        }

        /// @inheritdoc IAgent
        fn PROMPT_REWARD_BPS(self: @ContractState) -> u16 {
            PROMPT_REWARD_BPS
        }

        /// @inheritdoc IAgent
        fn CREATOR_REWARD_BPS(self: @ContractState) -> u16 {
            CREATOR_REWARD_BPS
        }

        /// @inheritdoc IAgent
        fn PROTOCOL_FEE_BPS(self: @ContractState) -> u16 {
            PROTOCOL_FEE_BPS
        }

        /// @inheritdoc IAgent
        fn BPS_DENOMINATOR(self: @ContractState) -> u16 {
            BPS_DENOMINATOR
        }
    }

    /// @notice Internal helper functions for the Agent contract
    /// @dev Contains utility functions for token management and validation
    #[generate_trait]
    impl AgentInternalImpl of AgentInternalTrait {
        /// @notice Drains all available tokens to specified address
        /// @param to Address to send tokens to
        /// @dev Updates is_drained flag and transfers prize pool
        fn _drain(ref self: ContractState, to: ContractAddress) {
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prize_pool = self._get_prize_pool(token);

            self.is_drained.write(true);

            token.transfer(to, prize_pool);
        }

        /// @notice Calculates fee splits for a prompt payment
        /// @param amount Total amount to split
        /// @return Tuple of (agent_amount, creator_fee, protocol_fee)
        /// @dev Uses basis points to calculate shares
        fn _split_amounts(self: @ContractState, amount: u256) -> (u256, u256, u256) {
            let creator_fee = (amount * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let protocol_fee = (amount * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = amount - creator_fee - protocol_fee;
            (agent_amount, creator_fee, protocol_fee)
        }

        /// @notice Calculates available prize pool
        /// @param token Token dispatcher
        /// @return Available prize pool amount
        /// @dev Subtracts pending pool from total balance
        fn _get_prize_pool(self: @ContractState, token: IERC20Dispatcher) -> u256 {
            token.balance_of(get_contract_address()) - self.pending_pool.read()
        }

        /// @notice Increases pending pool amount
        /// @param amount Amount to add
        /// @dev Updates pending_pool storage
        fn _increment_pending_pool(ref self: ContractState, amount: u256) {
            self.pending_pool.write(self.pending_pool.read() + amount);
        }

        /// @notice Decreases pending pool amount
        /// @param amount Amount to subtract
        /// @dev Updates pending_pool storage
        fn _decrement_pending_pool(ref self: ContractState, amount: u256) {
            self.pending_pool.write(self.pending_pool.read() - amount);
        }

        /// @notice Checks if registry is not paused
        /// @dev Reverts if registry is paused
        fn _assert_registry_not_paused(ref self: ContractState) {
            let registry = self.registry.read();
            let registry_pausable = IPausableDispatcher { contract_address: registry };
            assert(!registry_pausable.is_paused(), PausableComponent::Errors::PAUSED);
        }

        /// @notice Checks if agent is finalized
        /// @dev Reverts if not finalized
        fn _assert_finalized(ref self: ContractState) {
            assert(self.is_finalized(), 'Agent not been finalized');
        }

        /// @notice Checks if agent is not finalized
        /// @dev Reverts if finalized
        fn _assert_not_finalized(ref self: ContractState) {
            assert(!self.is_finalized(), 'Agent already been finalized');
        }

        /// @notice Checks if caller is registry
        /// @dev Reverts if caller is not registry
        fn _assert_caller_is_registry(ref self: ContractState) {
            assert(get_caller_address() == self.registry.read(), 'Only registry can call');
        }
    }
}
