use core::starknet::{ContractAddress, ClassHash};

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct TokenParams {
    pub min_prompt_price: u256,
    pub min_initial_balance: u256,
}

#[derive(Drop, Copy, Serde, starknet::Store)]
struct PendingPrompt {
    pub reclaimer: ContractAddress,
    pub amount: u256,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn get_agent(self: @TContractState, idx: u64) -> ContractAddress;
    fn get_agents_count(self: @TContractState) -> u64;
    fn get_agents(self: @TContractState, start: u64, end: u64) -> Array<ContractAddress>;
    fn get_token_params(self: @TContractState, token: ContractAddress) -> TokenParams;
    fn get_tee(self: @TContractState) -> ContractAddress;
    fn get_agent_class_hash(self: @TContractState) -> ClassHash;

    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);

    fn register_agent(
        ref self: TContractState,
        name: ByteArray,
        system_prompt: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        initial_balance: u256,
        end_time: u64,
    ) -> ContractAddress;
    fn is_agent_registered(self: @TContractState, address: ContractAddress) -> bool;

    fn consume_prompt(
        ref self: TContractState, agent: ContractAddress, prompt_id: u64, drain_to: ContractAddress,
    );

    fn add_supported_token(
        ref self: TContractState,
        token: ContractAddress,
        min_prompt_price: u256,
        min_initial_balance: u256,
    );
    fn remove_supported_token(ref self: TContractState, token: ContractAddress);
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
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
    fn get_token(self: @TContractState) -> ContractAddress;
    fn get_registry(self: @TContractState) -> ContractAddress;
    fn get_next_prompt_id(self: @TContractState) -> u64;
    fn get_pending_prompt(self: @TContractState, prompt_id: u64) -> PendingPrompt;
    fn get_prompt_count(self: @TContractState) -> u64;
    fn get_end_time(self: @TContractState) -> u64;
    fn get_user_tweet_prompt(
        self: @TContractState, user: ContractAddress, tweet_id: u64, idx: u64,
    ) -> u64;
    fn get_user_tweet_prompts_count(
        self: @TContractState, user: ContractAddress, tweet_id: u64,
    ) -> u64;
    fn get_user_tweet_prompts(
        self: @TContractState, user: ContractAddress, tweet_id: u64, start: u64, end: u64,
    ) -> Array<u64>;

    fn RECLAIM_DELAY(self: @TContractState) -> u64;
    fn PROMPT_REWARD_BPS(self: @TContractState) -> u16;
    fn CREATOR_REWARD_BPS(self: @TContractState) -> u16;
    fn PROTOCOL_FEE_BPS(self: @TContractState) -> u16;
    fn BPS_DENOMINATOR(self: @TContractState) -> u16;
}

#[starknet::contract]
pub mod AgentRegistry {
    use core::starknet::{ContractAddress, ClassHash, get_caller_address, get_contract_address};
    use core::starknet::syscalls::deploy_syscall;
    use core::starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess, Vec, VecTrait, MutableVecTrait,
    };
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::security::pausable::PausableComponent;

    use super::{IAgentDispatcher, IAgentDispatcherTrait, TokenParams};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        AgentRegistered: AgentRegistered,
        TokenAdded: TokenAdded,
        TokenRemoved: TokenRemoved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AgentRegistered {
        #[key]
        pub agent: ContractAddress,
        #[key]
        pub creator: ContractAddress,
        pub prompt_price: u256,
        pub token: ContractAddress,
        pub end_time: u64,
        pub name: ByteArray,
        pub system_prompt: ByteArray,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenAdded {
        #[key]
        pub token: ContractAddress,
        pub min_prompt_price: u256,
        pub min_initial_balance: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenRemoved {
        #[key]
        pub token: ContractAddress,
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        agent_class_hash: ClassHash,
        agent_registered: Map::<ContractAddress, bool>,
        agents: Vec::<ContractAddress>,
        tee: ContractAddress,
        token_params: Map::<ContractAddress, TokenParams>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        tee: ContractAddress,
        agent_class_hash: ClassHash,
    ) {
        self.ownable.initializer(owner);
        self.agent_class_hash.write(agent_class_hash);
        self.tee.write(tee);
    }

    #[abi(embed_v0)]
    impl AgentRegistryImpl of super::IAgentRegistry<ContractState> {
        fn register_agent(
            ref self: ContractState,
            name: ByteArray,
            system_prompt: ByteArray,
            token: ContractAddress,
            prompt_price: u256,
            initial_balance: u256,
            end_time: u64,
        ) -> ContractAddress {
            self.pausable.assert_not_paused();

            let token_params = self.token_params.read(token);
            assert(token_params.min_prompt_price != 0, 'Token not supported');
            assert(prompt_price >= token_params.min_prompt_price, 'Prompt price too low');
            assert(initial_balance >= token_params.min_initial_balance, 'Initial balance too low');

            let creator = get_caller_address();

            let registry = get_contract_address();

            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            registry.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);
            token.serialize(ref constructor_calldata);
            prompt_price.serialize(ref constructor_calldata);
            creator.serialize(ref constructor_calldata);
            end_time.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false,
            )
                .unwrap();

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(creator, deployed_address, initial_balance);

            self.agent_registered.write(deployed_address, true);
            self.agents.append().write(deployed_address);

            self
                .emit(
                    Event::AgentRegistered(
                        AgentRegistered {
                            agent: deployed_address,
                            creator,
                            name,
                            system_prompt,
                            token,
                            prompt_price,
                            end_time,
                        },
                    ),
                );

            deployed_address
        }

        fn get_agent(self: @ContractState, idx: u64) -> ContractAddress {
            self.agents.at(idx).read()
        }

        fn get_agents_count(self: @ContractState) -> u64 {
            self.agents.len()
        }

        fn get_agents(self: @ContractState, start: u64, mut end: u64) -> Array<ContractAddress> {
            let agents_len = self.agents.len();

            assert(start < end, 'Invalid range');

            if end > agents_len {
                end = agents_len;
            }

            let mut addresses = array![];
            for i in start..end {
                addresses.append(self.agents.at(i).read());
            };
            addresses
        }

        fn is_agent_registered(self: @ContractState, address: ContractAddress) -> bool {
            self.agent_registered.read(address)
        }

        fn consume_prompt(
            ref self: ContractState,
            agent: ContractAddress,
            prompt_id: u64,
            drain_to: ContractAddress,
        ) {
            self.pausable.assert_not_paused();
            assert(get_caller_address() == self.tee.read(), 'Only tee can consume');

            IAgentDispatcher { contract_address: agent }.consume_prompt(prompt_id, drain_to);
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }

        fn add_supported_token(
            ref self: ContractState,
            token: ContractAddress,
            min_prompt_price: u256,
            min_initial_balance: u256,
        ) {
            self.ownable.assert_only_owner();
            self.token_params.write(token, TokenParams { min_prompt_price, min_initial_balance });
            self
                .emit(
                    Event::TokenAdded(TokenAdded { token, min_prompt_price, min_initial_balance }),
                );
        }

        fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
            self.ownable.assert_only_owner();
            self
                .token_params
                .write(token, TokenParams { min_prompt_price: 0, min_initial_balance: 0 });
            self.emit(Event::TokenRemoved(TokenRemoved { token }));
        }

        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            let params = self.token_params.read(token);

            params.min_prompt_price != 0
        }

        fn get_token_params(self: @ContractState, token: ContractAddress) -> TokenParams {
            self.token_params.read(token)
        }

        fn get_tee(self: @ContractState) -> ContractAddress {
            self.tee.read()
        }

        fn get_agent_class_hash(self: @ContractState) -> ClassHash {
            self.agent_class_hash.read()
        }
    }
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
        prize_pool: u256,
        creator: ContractAddress,
        pending_prompts: Map::<u64, PendingPrompt>,
        user_tweet_prompts: Map::<ContractAddress, Map<u64, Vec<u64>>>,
        next_prompt_id: u64,
        end_time: u64,
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
            self.prize_pool.read()
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

        fn withdraw(ref self: ContractState) {
            let caller = get_caller_address();
            assert(caller == self.creator.read(), 'Only creator can withdraw');

            let current_time = get_block_timestamp();
            let end_time = self.end_time.read();
            assert(current_time > end_time + RECLAIM_DELAY, 'Too early to withdraw');

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            
            let prize_pool = self.prize_pool.read();
            self.prize_pool.write(0);

            token.transfer(caller, prize_pool);
        }

        fn pay_for_prompt(ref self: ContractState, tweet_id: u64, prompt: ByteArray) -> u64 {
            let current_time = get_block_timestamp();
            assert(current_time <= self.end_time.read(), 'Agent has expired');

            let registry = self.registry.read();
            let registry_pausable = IPausableDispatcher { contract_address: registry };
            assert(!registry_pausable.is_paused(), PausableComponent::Errors::PAUSED);

            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prompt_price = self.prompt_price.read();

            // Transfer tokens to this contract
            token.transfer_from(caller, get_contract_address(), prompt_price);

            // Generate unique prompt ID
            let prompt_id = self.next_prompt_id.read();
            self.next_prompt_id.write(prompt_id + 1);

            // Store pending prompt
            self
                .pending_prompts
                .write(
                    prompt_id,
                    PendingPrompt {
                        reclaimer: caller, amount: prompt_price, timestamp: current_time,
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

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            token.transfer(pending.reclaimer, pending.amount);

            self
                .pending_prompts
                .write(
                    prompt_id,
                    PendingPrompt {
                        reclaimer: contract_address_const::<0>(), amount: 0, timestamp: 0,
                    },
                );

            self
                .emit(
                    Event::PromptReclaimed(
                        PromptReclaimed { prompt_id, amount: pending.amount, reclaimer: caller },
                    ),
                );
        }

        fn consume_prompt(ref self: ContractState, prompt_id: u64, drain_to: ContractAddress) {
            let registry = self.registry.read();
            assert(get_caller_address() == registry, 'Only registry can consume');

            let pending = self.pending_prompts.read(prompt_id);
            assert(pending.reclaimer != contract_address_const::<0>(), 'No pending prompt');

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let amount = pending.amount;

            // Calculate fee splits
            let creator_fee = (amount * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let protocol_fee = (amount * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = amount - creator_fee - protocol_fee;

            // Transfer fees
            token.transfer(self.creator.read(), creator_fee);
            token.transfer(registry, protocol_fee);

            self.prize_pool.write(self.prize_pool.read() + agent_amount);

            // Clear pending prompt
            self
                .pending_prompts
                .write(
                    prompt_id,
                    PendingPrompt {
                        reclaimer: contract_address_const::<0>(), amount: 0, timestamp: 0,
                    },
                );

            if drain_to != get_contract_address() {
                let token = self.token.read();
                let balance = IERC20Dispatcher { contract_address: token }
                    .balance_of(get_contract_address());
                IERC20Dispatcher { contract_address: token }.transfer(drain_to, balance);
            }

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
}


// Mock ERC20 contract for testing purposes
#[starknet::contract]
mod ERC20 {
    use openzeppelin::token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use starknet::ContractAddress;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // ERC20 Mixin
    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_supply: u256, recipient: ContractAddress) {
        let name = "Test Token";
        let symbol = "TST";

        self.erc20.initializer(name, symbol);
        self.erc20.mint(recipient, initial_supply);
    }
}
