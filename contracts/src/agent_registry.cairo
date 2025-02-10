use core::starknet::ContractAddress;
use core::starknet::ClassHash;

/// @notice Parameters required for token support
/// @dev These parameters are required to both avoid spamming and also to make
/// sure the costs for running the infrastructure can be covered
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct TokenParams {
    /// @notice Minimum price that can be charged per prompt
    pub min_prompt_price: u256,
    /// @notice Minimum initial balance required to create an agent
    pub min_initial_balance: u256,
}

/// @notice Interface for interacting with the agent registry
#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    /// @notice Gets an agent address by index
    /// @param idx The index of the agent
    /// @return The agent's contract address
    fn get_agent(self: @TContractState, idx: u64) -> ContractAddress;

    /// @notice Gets total number of registered agents
    /// @return The total count of registered agents
    fn get_agents_count(self: @TContractState) -> u64;

    /// @notice Gets a range of agent addresses
    /// @param start The starting index
    /// @param end The ending index (exclusive)
    /// @return Array of agent addresses
    fn get_agents(self: @TContractState, start: u64, end: u64) -> Array<ContractAddress>;

    /// @notice Gets an agent address by its name
    /// @param name The name of the agent
    /// @return The agent's contract address
    fn get_agent_by_name(self: @TContractState, name: ByteArray) -> ContractAddress;

    /// @notice Gets parameters for a supported token
    /// @param token The token address
    /// @return The token parameters
    fn get_token_params(self: @TContractState, token: ContractAddress) -> TokenParams;

    /// @notice Gets the current TEE address
    /// @return The TEE contract address
    fn get_tee(self: @TContractState) -> ContractAddress;

    /// @notice Sets a new TEE address
    /// @param tee The new TEE address
    /// @dev Only callable by owner
    fn set_tee(ref self: TContractState, tee: ContractAddress);

    /// @notice Gets the current agent implementation class hash
    /// @return The class hash
    fn get_agent_class_hash(self: @TContractState) -> ClassHash;

    /// @notice Sets a new agent implementation class hash
    /// @param agent_class_hash The new class hash
    /// @dev Only callable by owner
    fn set_agent_class_hash(ref self: TContractState, agent_class_hash: ClassHash);

    /// @notice Pauses the contract
    /// @dev Only callable by owner
    fn pause(ref self: TContractState);

    /// @notice Unpauses the contract
    /// @dev Only callable by owner
    fn unpause(ref self: TContractState);

    /// @notice Emits an event indicating TEE unencumbrance
    /// @dev Only callable by owner
    fn unencumber(ref self: TContractState);

    /// @notice Registers a new agent with the given parameters
    /// @param name Unique name for the agent
    /// @param system_prompt Base prompt that defines agent behavior
    /// @param token Address of token used for payments
    /// @param prompt_price Price per prompt in token units
    /// @param initial_balance Initial token balance for the agent
    /// @param end_time Timestamp when agent will stop accepting new prompts
    /// @return The address of the newly created agent contract
    fn register_agent(
        ref self: TContractState,
        name: ByteArray,
        system_prompt: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        initial_balance: u256,
        end_time: u64,
    ) -> ContractAddress;

    /// @notice Checks if an address is a registered agent
    /// @param address The address to check
    /// @return True if address is a registered agent
    fn is_agent_registered(self: @TContractState, address: ContractAddress) -> bool;

    /// @notice Consumes a prompt and transfers tokens
    /// @param agent The agent contract address
    /// @param prompt_id The ID of the prompt to consume
    /// @param drain_to Address to send tokens to. If set to agent, it's not drained
    /// @dev Only callable by TEE
    fn consume_prompt(
        ref self: TContractState, agent: ContractAddress, prompt_id: u64, drain_to: ContractAddress,
    );

    /// @notice Adds support for a new token with minimum requirements
    /// @param token The token contract address
    /// @param min_prompt_price Minimum allowed price per prompt
    /// @param min_initial_balance Minimum required initial balance
    /// @dev Only callable by owner
    fn add_supported_token(
        ref self: TContractState,
        token: ContractAddress,
        min_prompt_price: u256,
        min_initial_balance: u256,
    );

    /// @notice Removes support for a token
    /// @param token The token to remove support for
    /// @dev Only callable by owner
    fn remove_supported_token(ref self: TContractState, token: ContractAddress);

    /// @notice Checks if a token is supported
    /// @param token The token address to check
    /// @return True if token is supported
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
}

/// @title Agent Registry Contract
/// @notice Manages registration and lifecycle of AI agents
/// @dev Implements ownership and pausability
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

    /// @notice Events emitted by the contract
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        /// @notice Emitted when contract is paused/unpaused
        #[flat]
        PausableEvent: PausableComponent::Event,
        /// @notice Emitted when ownership is transferred
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        /// @notice Emitted when a new agent is registered
        AgentRegistered: AgentRegistered,
        /// @notice Emitted when a new token is supported
        TokenAdded: TokenAdded,
        /// @notice Emitted when a token is removed
        TokenRemoved: TokenRemoved,
        /// @notice Emitted when TEE is unencumbered
        TeeUnencumbered: TeeUnencumbered,
    }

    /// @notice Emitted when a new agent is registered
    #[derive(Drop, starknet::Event)]
    pub struct AgentRegistered {
        /// @notice Address of the deployed agent contract
        #[key]
        pub agent: ContractAddress,
        /// @notice Address that created the agent
        #[key]
        pub creator: ContractAddress,
        /// @notice Price per prompt in token units
        pub prompt_price: u256,
        /// @notice Token used for payments
        pub token: ContractAddress,
        /// @notice Timestamp when agent stops accepting prompts
        pub end_time: u64,
        /// @notice Unique name of the agent
        pub name: ByteArray,
        /// @notice Base prompt defining agent behavior
        pub system_prompt: ByteArray,
    }

    /// @notice Emitted when a new token is supported
    #[derive(Drop, starknet::Event)]
    pub struct TokenAdded {
        /// @notice Address of the supported token
        #[key]
        pub token: ContractAddress,
        /// @notice Minimum allowed price per prompt
        pub min_prompt_price: u256,
        /// @notice Minimum required initial balance
        pub min_initial_balance: u256,
    }

    /// @notice Emitted when a token is removed from supported tokens
    #[derive(Drop, starknet::Event)]
    pub struct TokenRemoved {
        /// @notice Address of the removed token
        #[key]
        pub token: ContractAddress,
    }

    /// @notice Emitted when TEE is unencumbered
    #[derive(Drop, starknet::Event)]
    pub struct TeeUnencumbered {
        /// @notice Address of the unencumbered TEE
        #[key]
        pub tee: ContractAddress,
    }

    #[storage]
    struct Storage {
        /// @notice Ownable component storage
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        /// @notice Pausable component storage
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        /// @notice Class hash for agent contracts
        agent_class_hash: ClassHash,
        /// @notice Mapping from name hash to agent address
        agent_by_name_hash: Map::<felt252, ContractAddress>,
        /// @notice Mapping of registered agent addresses
        agent_registered: Map::<ContractAddress, bool>,
        /// @notice List of all registered agents
        agents: Vec::<ContractAddress>,
        /// @notice Address of the TEE contract
        tee: ContractAddress,
        /// @notice Mapping of token addresses to their parameters
        token_params: Map::<ContractAddress, TokenParams>,
    }

    /// @notice Contract constructor
    /// @param owner The address that will own the contract
    /// @param tee The initial TEE address
    /// @param agent_class_hash The class hash for agent contracts
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
        /// @inheritdoc IAgentRegistry
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

        /// @inheritdoc IAgentRegistry
        fn get_agent(self: @ContractState, idx: u64) -> ContractAddress {
            self.agents.at(idx).read()
        }

        /// @inheritdoc IAgentRegistry
        fn get_agents_count(self: @ContractState) -> u64 {
            self.agents.len()
        }

        /// @inheritdoc IAgentRegistry
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

        /// @inheritdoc IAgentRegistry
        fn is_agent_registered(self: @ContractState, address: ContractAddress) -> bool {
            self.agent_registered.read(address)
        }

        /// @inheritdoc IAgentRegistry
        fn get_agent_by_name(self: @ContractState, name: ByteArray) -> ContractAddress {
            let name_hash = hash_byte_array(@name);
            self.agent_by_name_hash.read(name_hash)
        }

        /// @inheritdoc IAgentRegistry
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

        /// @inheritdoc IAgentRegistry
        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        /// @inheritdoc IAgentRegistry
        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }

        /// @inheritdoc IAgentRegistry
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

        /// @inheritdoc IAgentRegistry
        fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
            self.ownable.assert_only_owner();
            self
                .token_params
                .write(token, TokenParams { min_prompt_price: 0, min_initial_balance: 0 });
            self.emit(Event::TokenRemoved(TokenRemoved { token }));
        }

        /// @inheritdoc IAgentRegistry
        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            let params = self.token_params.read(token);

            params.min_prompt_price != 0
        }

        /// @inheritdoc IAgentRegistry
        fn get_token_params(self: @ContractState, token: ContractAddress) -> TokenParams {
            self.token_params.read(token)
        }

        /// @inheritdoc IAgentRegistry
        fn get_tee(self: @ContractState) -> ContractAddress {
            self.tee.read()
        }

        /// @inheritdoc IAgentRegistry
        fn set_tee(ref self: ContractState, tee: ContractAddress) {
            self.ownable.assert_only_owner();
            self.tee.write(tee);
        }

        /// @inheritdoc IAgentRegistry
        fn get_agent_class_hash(self: @ContractState) -> ClassHash {
            self.agent_class_hash.read()
        }

        /// @inheritdoc IAgentRegistry
        fn set_agent_class_hash(ref self: ContractState, agent_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.agent_class_hash.write(agent_class_hash);
        }

        /// @inheritdoc IAgentRegistry
        fn unencumber(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.emit(Event::TeeUnencumbered(TeeUnencumbered { tee: self.tee.read() }));
        }
    }
}
