export const TEECEPTION_AGENTREGISTRY_ABI = [
  {
    type: 'impl',
    name: 'AgentRegistryImpl',
    interface_name: 'teeception::agent_registry::IAgentRegistry',
  },
  {
    type: 'struct',
    name: 'core::byte_array::ByteArray',
    members: [
      {
        name: 'data',
        type: 'core::array::Array::<core::bytes_31::bytes31>',
      },
      {
        name: 'pending_word',
        type: 'core::felt252',
      },
      {
        name: 'pending_word_len',
        type: 'core::integer::u32',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::integer::u256',
    members: [
      {
        name: 'low',
        type: 'core::integer::u128',
      },
      {
        name: 'high',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'struct',
    name: 'teeception::agent_registry::TokenParams',
    members: [
      {
        name: 'min_prompt_price',
        type: 'core::integer::u256',
      },
      {
        name: 'min_initial_balance',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'enum',
    name: 'core::bool',
    variants: [
      {
        name: 'False',
        type: '()',
      },
      {
        name: 'True',
        type: '()',
      },
    ],
  },
  {
    type: 'interface',
    name: 'teeception::agent_registry::IAgentRegistry',
    items: [
      {
        type: 'function',
        name: 'get_agent',
        inputs: [
          {
            name: 'idx',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_agents_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_agents',
        inputs: [
          {
            name: 'start',
            type: 'core::integer::u64',
          },
          {
            name: 'end',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_agent_by_name',
        inputs: [
          {
            name: 'name',
            type: 'core::byte_array::ByteArray',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_token_params',
        inputs: [
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'teeception::agent_registry::TokenParams',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_tee',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_tee',
        inputs: [
          {
            name: 'tee',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_agent_class_hash',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::class_hash::ClassHash',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'set_agent_class_hash',
        inputs: [
          {
            name: 'agent_class_hash',
            type: 'core::starknet::class_hash::ClassHash',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'pause',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unpause',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unencumber',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'register_agent',
        inputs: [
          {
            name: 'name',
            type: 'core::byte_array::ByteArray',
          },
          {
            name: 'system_prompt',
            type: 'core::byte_array::ByteArray',
          },
          {
            name: 'model',
            type: 'core::felt252',
          },
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'prompt_price',
            type: 'core::integer::u256',
          },
          {
            name: 'initial_balance',
            type: 'core::integer::u256',
          },
          {
            name: 'end_time',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'is_agent_registered',
        inputs: [
          {
            name: 'address',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'consume_prompt',
        inputs: [
          {
            name: 'agent',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'prompt_id',
            type: 'core::integer::u64',
          },
          {
            name: 'drain_to',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_supported_token',
        inputs: [
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'min_prompt_price',
            type: 'core::integer::u256',
          },
          {
            name: 'min_initial_balance',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_supported_token',
        inputs: [
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_supported_model',
        inputs: [
          {
            name: 'model',
            type: 'core::felt252',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_supported_model',
        inputs: [
          {
            name: 'model',
            type: 'core::felt252',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'is_token_supported',
        inputs: [
          {
            name: 'token',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_model_supported',
        inputs: [
          {
            name: 'model',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'OwnableImpl',
    interface_name: 'openzeppelin_access::ownable::interface::IOwnable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_access::ownable::interface::IOwnable',
    items: [
      {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'transfer_ownership',
        inputs: [
          {
            name: 'new_owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'renounce_ownership',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'PausableImpl',
    interface_name: 'openzeppelin_security::interface::IPausable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_security::interface::IPausable',
    items: [
      {
        type: 'function',
        name: 'is_paused',
        inputs: [],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'tee',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'agent_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Paused',
    kind: 'struct',
    members: [
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Unpaused',
    kind: 'struct',
    members: [
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Paused',
        type: 'openzeppelin_security::pausable::PausableComponent::Paused',
        kind: 'nested',
      },
      {
        name: 'Unpaused',
        type: 'openzeppelin_security::pausable::PausableComponent::Unpaused',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'OwnershipTransferred',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred',
        kind: 'nested',
      },
      {
        name: 'OwnershipTransferStarted',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'teeception::agent_registry::AgentRegistry::AgentRegistered',
    kind: 'struct',
    members: [
      {
        name: 'agent',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'creator',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'prompt_price',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'end_time',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'model',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'name',
        type: 'core::byte_array::ByteArray',
        kind: 'data',
      },
      {
        name: 'system_prompt',
        type: 'core::byte_array::ByteArray',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'teeception::agent_registry::AgentRegistry::TokenAdded',
    kind: 'struct',
    members: [
      {
        name: 'token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'min_prompt_price',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'min_initial_balance',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'teeception::agent_registry::AgentRegistry::TokenRemoved',
    kind: 'struct',
    members: [
      {
        name: 'token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'teeception::agent_registry::AgentRegistry::TeeUnencumbered',
    kind: 'struct',
    members: [
      {
        name: 'tee',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'teeception::agent_registry::AgentRegistry::Event',
    kind: 'enum',
    variants: [
      {
        name: 'PausableEvent',
        type: 'openzeppelin_security::pausable::PausableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'OwnableEvent',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'AgentRegistered',
        type: 'teeception::agent_registry::AgentRegistry::AgentRegistered',
        kind: 'nested',
      },
      {
        name: 'TokenAdded',
        type: 'teeception::agent_registry::AgentRegistry::TokenAdded',
        kind: 'nested',
      },
      {
        name: 'TokenRemoved',
        type: 'teeception::agent_registry::AgentRegistry::TokenRemoved',
        kind: 'nested',
      },
      {
        name: 'TeeUnencumbered',
        type: 'teeception::agent_registry::AgentRegistry::TeeUnencumbered',
        kind: 'nested',
      },
    ],
  },
] as const
