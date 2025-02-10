use core::starknet::ContractAddress;
use core::starknet::ClassHash;

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct TokenParams {
    pub min_prompt_price: u256,
    pub min_initial_balance: u256,
}

#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn get_agent(self: @TContractState, idx: u64) -> ContractAddress;
    fn get_agents_count(self: @TContractState) -> u64;
    fn get_agents(self: @TContractState, start: u64, end: u64) -> Array<ContractAddress>;
    fn get_agent_by_name(self: @TContractState, name: ByteArray) -> ContractAddress;
    fn get_token_params(self: @TContractState, token: ContractAddress) -> TokenParams;

    fn get_tee(self: @TContractState) -> ContractAddress;
    fn set_tee(ref self: TContractState, tee: ContractAddress);

    fn get_agent_class_hash(self: @TContractState) -> ClassHash;
    fn set_agent_class_hash(ref self: TContractState, agent_class_hash: ClassHash);

    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn unencumber(ref self: TContractState);

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

#[starknet::contract]
pub mod AgentRegistry {
    use core::starknet::ContractAddress;
    use core::starknet::ClassHash;
    use core::starknet::get_caller_address;
    use core::starknet::get_contract_address;
    use core::starknet::contract_address_const;

    use core::starknet::syscalls::deploy_syscall;

    use core::starknet::storage::Map;
    use core::starknet::storage::StorageMapReadAccess;
    use core::starknet::storage::StorageMapWriteAccess;
    use core::starknet::storage::StoragePointerReadAccess;
    use core::starknet::storage::StoragePointerWriteAccess;
    use core::starknet::storage::Vec;
    use core::starknet::storage::VecTrait;
    use core::starknet::storage::MutableVecTrait;

    use openzeppelin::token::erc20::interface::IERC20Dispatcher;
    use openzeppelin::token::erc20::interface::IERC20DispatcherTrait;

    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::security::pausable::PausableComponent;

    use crate::agent::IAgentDispatcher;
    use crate::agent::IAgentDispatcherTrait;

    use crate::utils::hash_byte_array;

    use super::TokenParams;

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
        TeeUnencumbered: TeeUnencumbered,
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

    #[derive(Drop, starknet::Event)]
    pub struct TeeUnencumbered {
        #[key]
        pub tee: ContractAddress,
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        agent_class_hash: ClassHash,
        agent_by_name_hash: Map::<felt252, ContractAddress>,
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

            let name_hash = hash_byte_array(@name);

            let agent_with_name_hash = self.agent_by_name_hash.read(name_hash);
            assert(agent_with_name_hash == contract_address_const::<0>(), 'Name already used');

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
            self.agent_by_name_hash.write(name_hash, deployed_address);

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

        fn get_agent_by_name(self: @ContractState, name: ByteArray) -> ContractAddress {
            let name_hash = hash_byte_array(@name);
            self.agent_by_name_hash.read(name_hash)
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

        fn set_tee(ref self: ContractState, tee: ContractAddress) {
            self.ownable.assert_only_owner();
            self.tee.write(tee);
        }

        fn get_agent_class_hash(self: @ContractState) -> ClassHash {
            self.agent_class_hash.read()
        }

        fn set_agent_class_hash(ref self: ContractState, agent_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.agent_class_hash.write(agent_class_hash);
        }

        fn unencumber(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.emit(Event::TeeUnencumbered(TeeUnencumbered { tee: self.tee.read() }));
        }
    }
}
