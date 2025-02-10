use core::starknet::ContractAddress;

#[derive(Drop, Copy, Serde, starknet::Store)]
struct PendingPrompt {
    pub reclaimer: ContractAddress,
    pub amount: u256,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IAgent<TContractState> {
    fn pay_for_prompt(ref self: TContractState, tweet_id: u64, prompt: ByteArray) -> u64;
    fn reclaim_prompt(ref self: TContractState, prompt_id: u64);
    fn consume_prompt(ref self: TContractState, prompt_id: u64, drain_to: ContractAddress);
    fn withdraw(ref self: TContractState);

    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn get_creator(self: @TContractState) -> ContractAddress;
    fn get_prompt_price(self: @TContractState) -> u256;
    fn get_prize_pool(self: @TContractState) -> u256;
    fn get_pending_pool(self: @TContractState) -> u256;
    fn get_token(self: @TContractState) -> ContractAddress;
    fn get_registry(self: @TContractState) -> ContractAddress;
    fn get_next_prompt_id(self: @TContractState) -> u64;
    fn get_pending_prompt(self: @TContractState, prompt_id: u64) -> PendingPrompt;
    fn get_prompt_count(self: @TContractState) -> u64;
    fn get_end_time(self: @TContractState) -> u64;
    fn get_is_drained(self: @TContractState) -> bool;
    fn get_user_tweet_prompt(
        self: @TContractState, user: ContractAddress, tweet_id: u64, idx: u64,
    ) -> u64;
    fn get_user_tweet_prompts_count(
        self: @TContractState, user: ContractAddress, tweet_id: u64,
    ) -> u64;
    fn get_user_tweet_prompts(
        self: @TContractState, user: ContractAddress, tweet_id: u64, start: u64, end: u64,
    ) -> Array<u64>;
    fn is_finalized(self: @TContractState) -> bool;

    fn RECLAIM_DELAY(self: @TContractState) -> u64;
    fn PROMPT_REWARD_BPS(self: @TContractState) -> u16;
    fn CREATOR_REWARD_BPS(self: @TContractState) -> u16;
    fn PROTOCOL_FEE_BPS(self: @TContractState) -> u16;
    fn BPS_DENOMINATOR(self: @TContractState) -> u16;
}


#[starknet::contract]
pub mod Agent {
    use core::starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePathEntry, StoragePointerWriteAccess, Vec, VecTrait, MutableVecTrait,
    };
    use core::starknet::{
        ContractAddress, get_caller_address, get_contract_address, get_block_timestamp,
        contract_address_const,
    };
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::security::{
        pausable::PausableComponent, interface::{IPausableDispatcher, IPausableDispatcherTrait},
    };

    use super::PendingPrompt;

    const PROMPT_REWARD_BPS: u16 = 7000; // 70% goes to agent
    const CREATOR_REWARD_BPS: u16 = 2000; // 20% goes to prompt creator
    const PROTOCOL_FEE_BPS: u16 = 1000; // 10% goes to protocol
    const BPS_DENOMINATOR: u16 = 10000;
    const RECLAIM_DELAY: u64 = 1800; // 30 minutes in seconds

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PromptPaid: PromptPaid,
        PromptConsumed: PromptConsumed,
        PromptReclaimed: PromptReclaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptPaid {
        #[key]
        pub user: ContractAddress,
        #[key]
        pub prompt_id: u64,
        #[key]
        pub tweet_id: u64,
        pub prompt: ByteArray,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptConsumed {
        #[key]
        pub prompt_id: u64,
        pub amount: u256,
        pub creator_fee: u256,
        pub protocol_fee: u256,
        pub drained_to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptReclaimed {
        #[key]
        pub prompt_id: u64,
        pub amount: u256,
        pub reclaimer: ContractAddress,
    }

    #[storage]
    struct Storage {
        registry: ContractAddress,
        system_prompt: ByteArray,
        name: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        pending_pool: u256,
        creator: ContractAddress,
        pending_prompts: Map::<u64, PendingPrompt>,
        user_tweet_prompts: Map::<ContractAddress, Map<u64, Vec<u64>>>,
        next_prompt_id: u64,
        end_time: u64,
        is_drained: bool,
    }

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

    #[abi(embed_v0)]
    impl AgentImpl of super::IAgent<ContractState> {
        fn get_name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn get_system_prompt(self: @ContractState) -> ByteArray {
            self.system_prompt.read()
        }

        fn get_prompt_price(self: @ContractState) -> u256 {
            self.prompt_price.read()
        }

        fn get_prize_pool(self: @ContractState) -> u256 {
            self._get_prize_pool(IERC20Dispatcher { contract_address: self.token.read() })
        }

        fn get_pending_pool(self: @ContractState) -> u256 {
            self.pending_pool.read()
        }

        fn get_creator(self: @ContractState) -> ContractAddress {
            self.creator.read()
        }

        fn get_token(self: @ContractState) -> ContractAddress {
            self.token.read()
        }

        fn get_registry(self: @ContractState) -> ContractAddress {
            self.registry.read()
        }

        fn get_next_prompt_id(self: @ContractState) -> u64 {
            self.next_prompt_id.read()
        }

        fn get_pending_prompt(self: @ContractState, prompt_id: u64) -> PendingPrompt {
            self.pending_prompts.read(prompt_id)
        }

        fn get_prompt_count(self: @ContractState) -> u64 {
            self.next_prompt_id.read() - 1
        }

        fn get_user_tweet_prompt(
            self: @ContractState, user: ContractAddress, tweet_id: u64, idx: u64,
        ) -> u64 {
            let vec = self.user_tweet_prompts.entry(user).entry(tweet_id);
            vec.at(idx).read()
        }

        fn get_user_tweet_prompts_count(
            self: @ContractState, user: ContractAddress, tweet_id: u64,
        ) -> u64 {
            self.user_tweet_prompts.entry(user).entry(tweet_id).len()
        }

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

        fn get_end_time(self: @ContractState) -> u64 {
            self.end_time.read()
        }

        fn get_is_drained(self: @ContractState) -> bool {
            self.is_drained.read()
        }

        fn is_finalized(self: @ContractState) -> bool {
            self.end_time.read() < get_block_timestamp() || self.is_drained.read()
        }

        fn withdraw(ref self: ContractState) {
            let caller = get_caller_address();
            assert(caller == self.creator.read(), 'Only creator can withdraw');

            self._assert_finalized();

            self._drain(caller);
        }

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

            // Store pending prompt
            self
                .pending_prompts
                .write(
                    prompt_id,
                    PendingPrompt {
                        reclaimer: caller, amount: prompt_price, timestamp: get_block_timestamp(),
                    },
                );

            // Store prompt ID
            self.user_tweet_prompts.entry(caller).entry(tweet_id).append().write(prompt_id);

            self.emit(Event::PromptPaid(PromptPaid { user: caller, prompt_id, tweet_id, prompt }));

            prompt_id
        }

        fn reclaim_prompt(ref self: ContractState, prompt_id: u64) {
            let pending = self.pending_prompts.read(prompt_id);
            let caller = get_caller_address();

            assert(
                get_block_timestamp() >= pending.timestamp + RECLAIM_DELAY, 'Too early to reclaim',
            );

            self._clear_pending_prompt(prompt_id);

            self
                .emit(
                    Event::PromptReclaimed(
                        PromptReclaimed { prompt_id, amount: pending.amount, reclaimer: caller },
                    ),
                );

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            token.transfer(pending.reclaimer, pending.amount);
        }

        fn consume_prompt(ref self: ContractState, prompt_id: u64, drain_to: ContractAddress) {
            self._assert_caller_is_registry();
            self._assert_not_finalized();

            let pending = self.pending_prompts.read(prompt_id);
            assert(pending.reclaimer != contract_address_const::<0>(), 'No pending prompt');

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let amount = pending.amount;

            // Calculate fee splits
            let (agent_amount, creator_fee, protocol_fee) = self._split_amounts(amount);

            // Clear pending prompt
            self._clear_pending_prompt(prompt_id);

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

        fn RECLAIM_DELAY(self: @ContractState) -> u64 {
            RECLAIM_DELAY
        }

        fn PROMPT_REWARD_BPS(self: @ContractState) -> u16 {
            PROMPT_REWARD_BPS
        }

        fn CREATOR_REWARD_BPS(self: @ContractState) -> u16 {
            CREATOR_REWARD_BPS
        }

        fn PROTOCOL_FEE_BPS(self: @ContractState) -> u16 {
            PROTOCOL_FEE_BPS
        }

        fn BPS_DENOMINATOR(self: @ContractState) -> u16 {
            BPS_DENOMINATOR
        }
    }

    #[generate_trait]
    impl AgentInternalImpl of AgentInternalTrait {
        fn _drain(ref self: ContractState, to: ContractAddress) {
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prize_pool = self._get_prize_pool(token);

            self.is_drained.write(true);

            token.transfer(to, prize_pool);
        }

        fn _split_amounts(self: @ContractState, amount: u256) -> (u256, u256, u256) {
            let creator_fee = (amount * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let protocol_fee = (amount * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = amount - creator_fee - protocol_fee;
            (agent_amount, creator_fee, protocol_fee)
        }

        fn _clear_pending_prompt(ref self: ContractState, prompt_id: u64) {
            self
                .pending_prompts
                .write(
                    prompt_id,
                    PendingPrompt {
                        reclaimer: contract_address_const::<0>(), amount: 0, timestamp: 0,
                    },
                );
        }

        fn _get_prize_pool(self: @ContractState, token: IERC20Dispatcher) -> u256 {
            token.balance_of(get_contract_address()) - self.pending_pool.read()
        }

        fn _increment_pending_pool(ref self: ContractState, amount: u256) {
            self.pending_pool.write(self.pending_pool.read() + amount);
        }

        fn _decrement_pending_pool(ref self: ContractState, amount: u256) {
            self.pending_pool.write(self.pending_pool.read() - amount);
        }

        fn _assert_registry_not_paused(ref self: ContractState) {
            let registry = self.registry.read();
            let registry_pausable = IPausableDispatcher { contract_address: registry };
            assert(!registry_pausable.is_paused(), PausableComponent::Errors::PAUSED);
        }

        fn _assert_finalized(ref self: ContractState) {
            assert(self.is_finalized(), 'Agent not been finalized');
        }

        fn _assert_not_finalized(ref self: ContractState) {
            assert(!self.is_finalized(), 'Agent already been finalized');
        }

        fn _assert_caller_is_registry(ref self: ContractState) {
            assert(get_caller_address() == self.registry.read(), 'Only registry can call');
        }
    }
}
