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
                            "name": "prompt_price",
                            "type": "core::integer::u256"
                        },
                        {
                            "name": "end_time",
                            "type": "core::integer::u64"
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
                }
            ]
        },
        {
            "type": "constructor",
            "name": "constructor",
            "inputs": [
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
            "name": "teeception::AgentRegistry::AgentRegistered",
            "kind": "struct",
            "members": [
                {
                    "name": "agent",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "data"
                },
                {
                    "name": "name",
                    "type": "core::byte_array::ByteArray",
                    "kind": "key"
                },
                {
                    "name": "creator",
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
                    "name": "AgentRegistered",
                    "type": "teeception::AgentRegistry::AgentRegistered",
                    "kind": "nested"
                }
            ]
        }
    ]
