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
}

#[starknet::interface]
pub trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn get_creator(self: @TContractState) -> ContractAddress;
    fn get_prompt_price(self: @TContractState) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress);
    fn pay_for_prompt(ref self: TContractState, twitter_message_id: u64);
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

    use super::{IAgentDispatcher, IAgentDispatcherTrait};

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
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
            assert(get_caller_address() == self.tee.read(), 'Only tee can transfer');
            IAgentDispatcher { contract_address: agent }.transfer(recipient);
        }
    }
}

#[starknet::contract]
pub mod Agent {
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::starknet::{ContractAddress, get_caller_address, get_contract_address};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    use super::{IAgentRegistryDispatcher, IAgentRegistryDispatcherTrait};

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        pub tweet_id: felt252,
    }

    const PROMPT_REWARD_BPS: u16 = 8000; // 80% goes to agent
    const CREATOR_REWARD_BPS: u16 = 2000; // 20% goes to prompt creator
    const BPS_DENOMINATOR: u16 = 10000;

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PromptPaid: PromptPaid,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptPaid {
        #[key]
        pub user: ContractAddress,
        #[key]
        pub twitter_message_id: u64,
        pub amount: u256,
        pub creator_fee: u256,
    }

    #[storage]
    struct Storage {
        registry: ContractAddress,
        system_prompt: ByteArray,
        name: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        creator: ContractAddress,
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

        fn pay_for_prompt(ref self: ContractState, twitter_message_id: u64) {
            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prompt_price = self.prompt_price.read();

            // Calculate fee split
            let creator_fee = (prompt_price * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = prompt_price - creator_fee;

            // Transfer tokens
            token.transfer_from(caller, get_contract_address(), agent_amount);
            token.transfer_from(caller, self.creator.read(), creator_fee);

            self
                .emit(
                    Event::PromptPaid(
                        PromptPaid {
                            user: caller, twitter_message_id, amount: agent_amount, creator_fee,
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
