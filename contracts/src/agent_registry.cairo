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
    /// @param model The model to use for the agent
    /// @param token Address of token used for payments
    /// @param prompt_price Price per prompt in token units
    /// @param initial_balance Initial token balance for the agent
    /// @param end_time Timestamp when agent will stop accepting new prompts
    /// @return The address of the newly created agent contract
    fn register_agent(
        ref self: TContractState,
        name: ByteArray,
        system_prompt: ByteArray,
        model: felt252,
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

    /// @notice Withdraws funds from the contract. Used to collect protocol fees
    /// @dev Only callable by owner
    fn withdraw(
        ref self: TContractState, to: ContractAddress, token: ContractAddress, amount: u256,
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

    /// @notice Adds a model to the allowed models
    /// @param model The model to add
    /// @dev Only callable by owner
    fn add_supported_model(ref self: TContractState, model: felt252);

    /// @notice Removes a model from the allowed models
    /// @param model The model to remove
    /// @dev Only callable by owner
    fn remove_supported_model(ref self: TContractState, model: felt252);

    /// @notice Checks if a token is supported
    /// @param token The token address to check
    /// @return True if token is supported
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;

    /// @notice Checks if a model is supported
    /// @param model The model to check
    /// @return True if model is supported
    fn is_model_supported(self: @TContractState, model: felt252) -> bool;
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
    #[derive(Drop, PartialEq, starknet::Event)]
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
    #[derive(Drop, PartialEq, starknet::Event)]
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
        /// @notice Model to use for the agent
        pub model: felt252,
        /// @notice Unique name of the agent
        pub name: ByteArray,
        /// @notice Base prompt defining agent behavior
        pub system_prompt: ByteArray,
    }

    /// @notice Emitted when a new token is supported
    #[derive(Drop, PartialEq, starknet::Event)]
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
    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct TokenRemoved {
        /// @notice Address of the removed token
        #[key]
        pub token: ContractAddress,
    }

    /// @notice Emitted when TEE is unencumbered
    #[derive(Drop, PartialEq, starknet::Event)]
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
        /// @notice Mapping of allowed models
        supported_models: Map::<felt252, bool>,
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
            model: felt252,
            token: ContractAddress,
            prompt_price: u256,
            initial_balance: u256,
            end_time: u64,
        ) -> ContractAddress {
            self._assert_not_paused();
            let name_hash = self._assert_agent_name_unique(@name);
            self._assert_token_params_met(token, prompt_price, initial_balance);
            self._assert_model_supported(model);

            let creator = get_caller_address();

            let deployed_address = self
                ._deploy_agent(
                    creator, @name, @system_prompt, model, token, prompt_price, end_time,
                );

            self.agent_registered.write(deployed_address, true);
            self.agents.append().write(deployed_address);
            self.agent_by_name_hash.write(name_hash, deployed_address);

            self
                .emit(
                    Event::AgentRegistered(
                        AgentRegistered {
                            agent: deployed_address,
                            creator,
                            name: name.clone(),
                            system_prompt: system_prompt.clone(),
                            model,
                            token,
                            prompt_price,
                            end_time,
                        },
                    ),
                );

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(creator, deployed_address, initial_balance);

            deployed_address
        }

        /// @inheritdoc IAgentRegistry
        fn consume_prompt(
            ref self: ContractState,
            agent: ContractAddress,
            prompt_id: u64,
            drain_to: ContractAddress,
        ) {
            self._assert_not_paused();
            self._assert_caller_is_tee();
            self._assert_agent_registered(agent);

            IAgentDispatcher { contract_address: agent }.consume_prompt(prompt_id, drain_to);
        }

        /// @inheritdoc IAgentRegistry
        fn unencumber(ref self: ContractState) {
            self._assert_caller_is_owner();
            self.emit(Event::TeeUnencumbered(TeeUnencumbered { tee: self.tee.read() }));
        }

        /// @inheritdoc IAgentRegistry
        fn withdraw(
            ref self: ContractState, to: ContractAddress, token: ContractAddress, amount: u256,
        ) {
            self._assert_caller_is_owner();

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(to, amount);
        }

        /// @inheritdoc IAgentRegistry
        fn add_supported_token(
            ref self: ContractState,
            token: ContractAddress,
            min_prompt_price: u256,
            min_initial_balance: u256,
        ) {
            self._assert_caller_is_owner();

            self.token_params.write(token, TokenParams { min_prompt_price, min_initial_balance });
            self
                .emit(
                    Event::TokenAdded(TokenAdded { token, min_prompt_price, min_initial_balance }),
                );
        }

        /// @inheritdoc IAgentRegistry
        fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
            self._assert_caller_is_owner();

            self
                .token_params
                .write(token, TokenParams { min_prompt_price: 0, min_initial_balance: 0 });
            self.emit(Event::TokenRemoved(TokenRemoved { token }));
        }

        /// @inheritdoc IAgentRegistry
        fn add_supported_model(ref self: ContractState, model: felt252) {
            self._assert_caller_is_owner();
            self.supported_models.write(model, true);
        }

        /// @inheritdoc IAgentRegistry
        fn remove_supported_model(ref self: ContractState, model: felt252) {
            self._assert_caller_is_owner();
            self.supported_models.write(model, false);
        }

        /// @inheritdoc IAgentRegistry
        fn pause(ref self: ContractState) {
            self._assert_caller_is_owner();
            self.pausable.pause();
        }

        /// @inheritdoc IAgentRegistry
        fn unpause(ref self: ContractState) {
            self._assert_caller_is_owner();
            self.pausable.unpause();
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
        fn is_model_supported(self: @ContractState, model: felt252) -> bool {
            self.supported_models.read(model)
        }

        /// @inheritdoc IAgentRegistry
        fn get_agent_by_name(self: @ContractState, name: ByteArray) -> ContractAddress {
            let name_hash = hash_byte_array(@name);
            self.agent_by_name_hash.read(name_hash)
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
            self._assert_caller_is_owner();
            self.tee.write(tee);
        }

        /// @inheritdoc IAgentRegistry
        fn get_agent_class_hash(self: @ContractState) -> ClassHash {
            self.agent_class_hash.read()
        }

        /// @inheritdoc IAgentRegistry
        fn set_agent_class_hash(ref self: ContractState, agent_class_hash: ClassHash) {
            self._assert_caller_is_owner();
            self.agent_class_hash.write(agent_class_hash);
        }
    }

    /// @notice Internal helper functions for the AgentRegistry contract
    /// @dev Contains utility functions for agent deployment and validation
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// @notice Deploys a new agent contract
        /// @param creator Address that will own the agent
        /// @param name Unique name for the agent
        /// @param system_prompt Base prompt defining agent behavior
        /// @param token Token used for payments
        /// @param prompt_price Price per prompt in token units
        /// @param end_time Timestamp when agent stops accepting prompts
        /// @return The deployed agent's address
        /// @dev Serializes constructor args and deploys using class hash
        fn _deploy_agent(
            self: @ContractState,
            creator: ContractAddress,
            name: @ByteArray,
            system_prompt: @ByteArray,
            model: felt252,
            token: ContractAddress,
            prompt_price: u256,
            end_time: u64,
        ) -> ContractAddress {
            let registry = get_contract_address();

            let mut constructor_calldata = ArrayTrait::<felt252>::new();
            name.serialize(ref constructor_calldata);
            registry.serialize(ref constructor_calldata);
            system_prompt.serialize(ref constructor_calldata);
            model.serialize(ref constructor_calldata);
            token.serialize(ref constructor_calldata);
            prompt_price.serialize(ref constructor_calldata);
            creator.serialize(ref constructor_calldata);
            end_time.serialize(ref constructor_calldata);

            let (deployed_address, _) = deploy_syscall(
                self.agent_class_hash.read(), 0, constructor_calldata.span(), false,
            )
                .unwrap();

            deployed_address
        }

        /// @notice Checks if caller is owner
        /// @dev Reverts if caller is not owner
        fn _assert_caller_is_owner(self: @ContractState) {
            self.ownable.assert_only_owner();
        }

        /// @notice Checks if caller is TEE
        /// @dev Reverts if caller is not TEE
        fn _assert_caller_is_tee(self: @ContractState) {
            assert(get_caller_address() == self.tee.read(), 'Only tee can call');
        }

        /// @notice Checks if contract is not paused
        /// @dev Reverts if contract is paused
        fn _assert_not_paused(self: @ContractState) {
            self.pausable.assert_not_paused();
        }

        /// @notice Checks if agent is registered
        /// @param agent Address of agent to check
        /// @dev Reverts if agent is not registered
        fn _assert_agent_registered(self: @ContractState, agent: ContractAddress) {
            assert(self.agent_registered.read(agent), 'Agent not registered');
        }

        /// @notice Validates token parameters are met
        /// @param token Token address to validate
        /// @param prompt_price Price per prompt to validate
        /// @param initial_balance Initial balance to validate
        /// @dev Reverts if any parameters are invalid
        fn _assert_token_params_met(
            self: @ContractState, token: ContractAddress, prompt_price: u256, initial_balance: u256,
        ) {
            let token_params = self.token_params.read(token);
            assert(token_params.min_prompt_price != 0, 'Token not supported');
            assert(prompt_price >= token_params.min_prompt_price, 'Prompt price too low');
            assert(initial_balance >= token_params.min_initial_balance, 'Initial balance too low');
        }

        /// @notice Checks if agent name is unique
        /// @param name Name to check uniqueness
        /// @return Hash of the name
        /// @dev Reverts if name is already used
        fn _assert_agent_name_unique(self: @ContractState, name: @ByteArray) -> felt252 {
            let name_hash = hash_byte_array(name);
            let agent_with_name_hash = self.agent_by_name_hash.read(name_hash);
            assert(agent_with_name_hash == contract_address_const::<0>(), 'Name already used');

            name_hash
        }

        // @notice Checks if model is supported
        // @param model Model to check
        // @dev Reverts if model is not supported
        fn _assert_model_supported(self: @ContractState, model: felt252) {
            assert(self.supported_models.read(model), 'Model not supported');
        }
    }
}
