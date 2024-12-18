use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn register_agent(
        ref self: TContractState, name: ByteArray, system_prompt: ByteArray, prompt_price: u256,
    ) -> ContractAddress;
    fn get_token(self: @TContractState) -> ContractAddress;
    fn is_agent_registered(self: @TContractState, address: ContractAddress) -> bool;
    fn get_agents(self: @TContractState) -> Array<ContractAddress>;
    fn get_registration_price(self: @TContractState) -> u256;
    fn transfer(ref self: TContractState, agent: ContractAddress, recipient: ContractAddress);
    fn consume_prompt(ref self: TContractState, agent: ContractAddress, prompt_id: u64);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

#[starknet::interface]
pub trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn get_creator(self: @TContractState) -> ContractAddress;
    fn get_prompt_price(self: @TContractState) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress);
    fn pay_for_prompt(ref self: TContractState, twitter_message_id: u64) -> u64;
    fn reclaim_prompt(ref self: TContractState, prompt_id: u64);
    fn consume_prompt(ref self: TContractState, prompt_id: u64);
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

    use super::{IAgentDispatcher, IAgentDispatcherTrait};

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
    }

    #[derive(Drop, starknet::Event)]
    pub struct AgentRegistered {
        pub agent: ContractAddress,
        #[key]
        pub name: ByteArray,
        #[key]
        pub creator: ContractAddress,
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
        token: ContractAddress,
        registration_price: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        tee: ContractAddress,
        agent_class_hash: ClassHash,
        token: ContractAddress,
        registration_price: u256,
    ) {
        self.ownable.initializer(get_caller_address());
        self.agent_class_hash.write(agent_class_hash);
        self.tee.write(tee);
        self.token.write(token);
        self.registration_price.write(registration_price);
    }

    #[abi(embed_v0)]
    impl AgentRegistryImpl of super::IAgentRegistry<ContractState> {
        fn register_agent(
            ref self: ContractState, name: ByteArray, system_prompt: ByteArray, prompt_price: u256,
        ) -> ContractAddress {
            self.pausable.assert_not_paused();

            let creator = get_caller_address();

            let token = IERC20Dispatcher { contract_address: self.token.read() };

            // TODO: redirect to the owner
            token.transfer_from(creator, get_contract_address(), self.registration_price.read());

            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);
            self.token.read().serialize(ref constructor_calldata);
            prompt_price.serialize(ref constructor_calldata);
            creator.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false,
            )
                .unwrap();

            self.agent_registered.write(deployed_address, true);
            self.agents.append().write(deployed_address);

            self
                .emit(
                    Event::AgentRegistered(
                        AgentRegistered { agent: deployed_address, creator, name },
                    ),
                );

            deployed_address
        }

        fn get_agents(self: @ContractState) -> Array<ContractAddress> {
            let mut addresses = array![];
            for i in 0..self.agents.len() {
                addresses.append(self.agents.at(i).read());
            };
            addresses
        }

        fn is_agent_registered(self: @ContractState, address: ContractAddress) -> bool {
            self.agent_registered.read(address)
        }

        fn get_token(self: @ContractState) -> ContractAddress {
            self.token.read()
        }

        fn get_registration_price(self: @ContractState) -> u256 {
            self.registration_price.read()
        }

        fn transfer(ref self: ContractState, agent: ContractAddress, recipient: ContractAddress) {
            self.pausable.assert_not_paused();

            assert(get_caller_address() == self.tee.read(), 'Only tee can transfer');
            IAgentDispatcher { contract_address: agent }.transfer(recipient);
        }

        fn consume_prompt(ref self: ContractState, agent: ContractAddress, prompt_id: u64) {
            self.pausable.assert_not_paused();
            assert(get_caller_address() == self.tee.read(), 'Only tee can consume');
            IAgentDispatcher { contract_address: agent }.consume_prompt(prompt_id);
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }
    }
}

#[starknet::contract]
pub mod Agent {
    use core::starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use core::starknet::{
        ContractAddress, get_caller_address, get_contract_address, get_block_timestamp,
        contract_address_const,
    };
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::security::{
        pausable::PausableComponent, interface::{IPausableDispatcher, IPausableDispatcherTrait},
    };

    use super::{IAgentRegistryDispatcher, IAgentRegistryDispatcherTrait};

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        pub tweet_id: felt252,
    }

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
        pub twitter_message_id: u64,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptConsumed {
        #[key]
        pub prompt_id: u64,
        pub amount: u256,
        pub creator_fee: u256,
        pub protocol_fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptReclaimed {
        #[key]
        pub prompt_id: u64,
        pub amount: u256,
        pub reclaimer: ContractAddress,
    }

    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct PendingPrompt {
        reclaimer: ContractAddress,
        amount: u256,
        timestamp: u64,
    }

    #[storage]
    struct Storage {
        registry: ContractAddress,
        system_prompt: ByteArray,
        name: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        creator: ContractAddress,
        pending_prompts: Map::<u64, PendingPrompt>,
        next_prompt_id: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        system_prompt: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        creator: ContractAddress,
    ) {
        self.registry.write(get_caller_address());
        self.name.write(name);
        self.system_prompt.write(system_prompt);
        self.token.write(token);
        self.prompt_price.write(prompt_price);
        self.creator.write(creator);
        self.next_prompt_id.write(1_u64);
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

        fn get_creator(self: @ContractState) -> ContractAddress {
            self.creator.read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress) {
            let registry = self.registry.read();

            assert(get_caller_address() == registry, 'Only registry can transfer');

            let token = IAgentRegistryDispatcher { contract_address: registry }.get_token();
            let balance = IERC20Dispatcher { contract_address: token }
                .balance_of(get_contract_address());
            IERC20Dispatcher { contract_address: token }.transfer(recipient, balance);
        }

        fn pay_for_prompt(ref self: ContractState, twitter_message_id: u64) -> u64 {
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
                        reclaimer: caller, amount: prompt_price, timestamp: get_block_timestamp(),
                    },
                );

            self
                .emit(
                    Event::PromptPaid(
                        PromptPaid {
                            user: caller, prompt_id, twitter_message_id, amount: prompt_price,
                        },
                    ),
                );

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

        fn consume_prompt(ref self: ContractState, prompt_id: u64) {
            let registry = self.registry.read();
            assert(get_caller_address() == registry, 'Only registry can consume');

            let pending = self.pending_prompts.read(prompt_id);
            assert(pending.amount > 0, 'No pending prompt');

            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let amount = pending.amount;

            // Calculate fee splits
            let creator_fee = (amount * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let protocol_fee = (amount * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = amount - creator_fee - protocol_fee;

            // Transfer fees
            token.transfer(self.creator.read(), creator_fee);
            token.transfer(registry, protocol_fee);

            // Clear pending prompt
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
                    Event::PromptConsumed(
                        PromptConsumed {
                            prompt_id, amount: agent_amount, creator_fee, protocol_fee,
                        },
                    ),
                );
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
