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
}

#[starknet::contract]
mod AgentRegistry {
    use core::starknet::storage::{
        Vec, VecTrait, MutableVecTrait, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use core::starknet::{ContractAddress, ClassHash};
    use core::starknet::syscalls::deploy_syscall;
    use core::starknet::get_caller_address;
    use super::{IAgentDispatcher, IAgentDispatcherTrait};

    #[storage]
    struct Storage {
        agent_class_hash: ClassHash,
        agents: Vec<ContractAddress>,
        tee: ContractAddress,
        token: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        agent_class_hash: ClassHash,
        tee: ContractAddress,
        token: ContractAddress,
    ) {
        self.agent_class_hash.write(agent_class_hash);
        self.tee.write(tee);
        self.token.write(token);
    }

    #[abi(embed_v0)]
    impl AgentRegistryImpl of super::IAgentRegistry<ContractState> {
        fn register_agent(ref self: ContractState, name: ByteArray, system_prompt: ByteArray) {
            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false,
            )
                .unwrap();

            self.agents.append().write(deployed_address);
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
mod Agent {
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::starknet::{ContractAddress, get_caller_address};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::{IAgentRegistryDispatcher, IAgentRegistryDispatcherTrait};
    use starknet::get_contract_address;

    #[storage]
    struct Storage {
        registry: ContractAddress,
        system_prompt: ByteArray,
        name: ByteArray,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, system_prompt: ByteArray) {
        self.registry.write(get_caller_address());
        self.name.write(name);
        self.system_prompt.write(system_prompt);
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
