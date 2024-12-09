use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn register_agent(ref self: TContractState, name: ByteArray, system_prompt: ByteArray);
    fn get_token(self: @TContractState) -> ContractAddress;
    fn get_agents(self: @TContractState) -> Array<ContractAddress>;
    
    fn transfer(ref self: TContractState, agent: ContractAddress, recipient: ContractAddress);
}

#[starknet::interface]
pub trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn transfer(ref self: TContractState, recipient: ContractAddress);
    fn pay_for_prompt(ref self: TContractState, twitter_message_id: u64);
    fn get_creator(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod AgentRegistry {
    use core::starknet::storage::{
        Vec, VecTrait, MutableVecTrait, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use core::starknet::{ContractAddress, ClassHash};
    use core::starknet::syscalls::deploy_syscall;
    use core::starknet::get_caller_address;
    use super::{IAgentDispatcher, IAgentDispatcherTrait};

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PromptPaid: PromptPaid,
        AgentRegistered: AgentRegistered,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PromptPaid {
        pub user: ContractAddress,
        pub agent: ContractAddress,
        pub twitter_message_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AgentRegistered {
        pub agent: ContractAddress,
        pub creator: ContractAddress,
        pub name: ByteArray,
    }

    #[storage]
    struct Storage {
        agent_class_hash: ClassHash,
        agents: Vec<ContractAddress>,
        tee: ContractAddress,
        token: ContractAddress,
        prompt_price: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        agent_class_hash: ClassHash,
        token: ContractAddress,
        prompt_price: u256,
    ) {
        let tee = get_caller_address();
        self.agent_class_hash.write(agent_class_hash);
        self.tee.write(tee);
        self.token.write(token);
        self.prompt_price.write(prompt_price);
    }

    #[abi(embed_v0)]
    impl AgentRegistryImpl of super::IAgentRegistry<ContractState> {
        fn register_agent(ref self: ContractState, name: ByteArray, system_prompt: ByteArray) {
            let creator = get_caller_address();
            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);
            self.token.read().serialize(ref constructor_calldata);
            self.prompt_price.read().serialize(ref constructor_calldata);
            creator.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false,
            ).unwrap();

            self.agents.append().write(deployed_address);

            self.emit(Event::AgentRegistered(AgentRegistered {
                agent: deployed_address,
                creator,
                name,
            }));
        }

        fn get_agents(self: @ContractState) -> Array<ContractAddress> {
            let mut addresses = array![];
            for i in 0..self.agents.len() {
                addresses.append(self.agents.at(i).read());
            };
            addresses
        }

        fn get_token(self: @ContractState) -> ContractAddress {
            self.token.read()
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
    use core::starknet::{ContractAddress, get_caller_address};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::{IAgentRegistryDispatcher, IAgentRegistryDispatcherTrait};
    use starknet::get_contract_address;

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
        pub user: ContractAddress,
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
        let registry = get_caller_address();
        self.registry.write(registry);
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

        fn transfer(ref self: ContractState, recipient: ContractAddress) {
            assert(get_caller_address() == self.registry.read(), 'Only registry can transfer');
            let token = IAgentRegistryDispatcher { contract_address: self.registry.read() }
                .get_token();
            let balance = IERC20Dispatcher { contract_address: token }
                .balance_of(get_contract_address());
            IERC20Dispatcher { contract_address: token }.transfer(recipient, balance);
        }

        fn get_creator(self: @ContractState) -> ContractAddress {
            self.creator.read()
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

            self.emit(Event::PromptPaid(PromptPaid {
                user: caller,
                twitter_message_id,
                amount: agent_amount,
                creator_fee,
            }));
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
