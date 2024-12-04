use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn register_agent(ref self: TContractState, name: ByteArray, system_prompt: ByteArray);
    fn get_agents(self: @TContractState) -> Array<ContractAddress>;
}

#[starknet::interface]
pub trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
}

#[starknet::contract]
mod AgentRegistry {
    use core::starknet::storage::{Vec, VecTrait, MutableVecTrait, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::starknet::{ContractAddress, ClassHash};
    use core::starknet::syscalls::deploy_syscall;

    #[storage]
    struct Storage {
        agent_class_hash: ClassHash,
        agents: Vec<ContractAddress>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        agent_class_hash: ClassHash,
    ) {
        self.agent_class_hash.write(agent_class_hash);
    }

    #[abi(embed_v0)]
    impl AgentRegistryImpl of super::IAgentRegistry<ContractState> {
        fn register_agent(ref self: ContractState, name: ByteArray, system_prompt: ByteArray) {
            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false
            ).unwrap();
 
            self.agents.append().write(deployed_address);
        }

        fn get_agents(self: @ContractState) -> Array<ContractAddress> {
            let mut addresses = array![];
            for i in 0..self.agents.len() {
                addresses.append(self.agents.at(i).read());
            };
            addresses
        }
    }
}

#[starknet::contract]
mod Agent {
    use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        system_prompt: ByteArray,
        name: ByteArray,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        system_prompt: ByteArray,
    ) {
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
    }

}