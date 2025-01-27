export const AGENT_REGISTRY_COPY_ABI =
    [
        {
            "type": "impl",
            "name": "AgentRegistryImpl",
            "interface_name": "teeception::IAgentRegistry"
        },
        {
            "type": "struct",
            "name": "core::byte_array::ByteArray",
            "members": [
                {
                    "name": "data",
                    "type": "core::array::Array::<core::bytes_31::bytes31>"
                },
                {
                    "name": "pending_word",
                    "type": "core::felt252"
                },
                {
                    "name": "pending_word_len",
                    "type": "core::integer::u32"
                }
            ]
        },
        {
            "type": "struct",
            "name": "core::integer::u256",
            "members": [
                {
                    "name": "low",
                    "type": "core::integer::u128"
                },
                {
                    "name": "high",
                    "type": "core::integer::u128"
                }
            ]
        },
        {
            "type": "enum",
            "name": "core::bool",
            "variants": [
                {
                    "name": "False",
                    "type": "()"
                },
                {
                    "name": "True",
                    "type": "()"
                }
            ]
        },
        {
            "type": "interface",
            "name": "teeception::IAgentRegistry",
            "items": [
                {
                    "type": "function",
                    "name": "register_agent",
                    "inputs": [
                        {
                            "name": "name",
                            "type": "core::byte_array::ByteArray"
                        },
                        {
                            "name": "system_prompt",
                            "type": "core::byte_array::ByteArray"
                        },
                        {
                            "name": "token",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "prompt_price",
                            "type": "core::integer::u256"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "get_token",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "is_agent_registered",
                    "inputs": [
                        {
                            "name": "address",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::bool"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_agents",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_registration_price",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u256"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "transfer",
                    "inputs": [
                        {
                            "name": "agent",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "recipient",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "consume_prompt",
                    "inputs": [
                        {
                            "name": "agent",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "prompt_id",
                            "type": "core::integer::u64"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "pause",
                    "inputs": [],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "unpause",
                    "inputs": [],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "add_supported_token",
                    "inputs": [
                        {
                            "name": "token",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "min_prompt_price",
                            "type": "core::integer::u256"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "remove_supported_token",
                    "inputs": [
                        {
                            "name": "token",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "is_token_supported",
                    "inputs": [
                        {
                            "name": "token",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::bool"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_min_prompt_price",
                    "inputs": [
                        {
                            "name": "token",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::integer::u256"
                        }
                    ],
                    "state_mutability": "view"
                }
            ]
        },
        {
            "type": "impl",
            "name": "OwnableImpl",
            "interface_name": "openzeppelin_access::ownable::interface::IOwnable"
        },
        {
            "type": "interface",
            "name": "openzeppelin_access::ownable::interface::IOwnable",
            "items": [
                {
                    "type": "function",
                    "name": "owner",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "transfer_ownership",
                    "inputs": [
                        {
                            "name": "new_owner",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "renounce_ownership",
                    "inputs": [],
                    "outputs": [],
                    "state_mutability": "external"
                }
            ]
        },
        {
            "type": "impl",
            "name": "PausableImpl",
            "interface_name": "openzeppelin_security::interface::IPausable"
        },
        {
            "type": "interface",
            "name": "openzeppelin_security::interface::IPausable",
            "items": [
                {
                    "type": "function",
                    "name": "is_paused",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::bool"
                        }
                    ],
                    "state_mutability": "view"
                }
            ]
        },
        {
            "type": "constructor",
            "name": "constructor",
            "inputs": [
                {
                    "name": "owner",
                    "type": "core::starknet::contract_address::ContractAddress"
                },
                {
                    "name": "tee",
                    "type": "core::starknet::contract_address::ContractAddress"
                },
                {
                    "name": "agent_class_hash",
                    "type": "core::starknet::class_hash::ClassHash"
                },
                {
                    "name": "token",
                    "type": "core::starknet::contract_address::ContractAddress"
                },
                {
                    "name": "registration_price",
                    "type": "core::integer::u256"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_security::pausable::PausableComponent::Paused",
            "kind": "struct",
            "members": [
                {
                    "name": "account",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_security::pausable::PausableComponent::Unpaused",
            "kind": "struct",
            "members": [
                {
                    "name": "account",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_security::pausable::PausableComponent::Event",
            "kind": "enum",
            "variants": [
                {
                    "name": "Paused",
                    "type": "openzeppelin_security::pausable::PausableComponent::Paused",
                    "kind": "nested"
                },
                {
                    "name": "Unpaused",
                    "type": "openzeppelin_security::pausable::PausableComponent::Unpaused",
                    "kind": "nested"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
            "kind": "struct",
            "members": [
                {
                    "name": "previous_owner",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "new_owner",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
            "kind": "struct",
            "members": [
                {
                    "name": "previous_owner",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "new_owner",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                }
            ]
        },
        {
            "type": "event",
            "name": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
            "kind": "enum",
            "variants": [
                {
                    "name": "OwnershipTransferred",
                    "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
                    "kind": "nested"
                },
                {
                    "name": "OwnershipTransferStarted",
                    "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
                    "kind": "nested"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::AgentRegistry::AgentRegistered",
            "kind": "struct",
            "members": [
                {
                    "name": "agent",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "creator",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "name",
                    "type": "core::byte_array::ByteArray",
                    "kind": "data"
                },
                {
                    "name": "system_prompt",
                    "type": "core::byte_array::ByteArray",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::AgentRegistry::TokenAdded",
            "kind": "struct",
            "members": [
                {
                    "name": "token",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "min_prompt_price",
                    "type": "core::integer::u256",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::AgentRegistry::TokenRemoved",
            "kind": "struct",
            "members": [
                {
                    "name": "token",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::AgentRegistry::Event",
            "kind": "enum",
            "variants": [
                {
                    "name": "PausableEvent",
                    "type": "openzeppelin_security::pausable::PausableComponent::Event",
                    "kind": "flat"
                },
                {
                    "name": "OwnableEvent",
                    "type": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
                    "kind": "flat"
                },
                {
                    "name": "AgentRegistered",
                    "type": "teeception::AgentRegistry::AgentRegistered",
                    "kind": "nested"
                },
                {
                    "name": "TokenAdded",
                    "type": "teeception::AgentRegistry::TokenAdded",
                    "kind": "nested"
                },
                {
                    "name": "TokenRemoved",
                    "type": "teeception::AgentRegistry::TokenRemoved",
                    "kind": "nested"
                }
            ]
        }
    ]