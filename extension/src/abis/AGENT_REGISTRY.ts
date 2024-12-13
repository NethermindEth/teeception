export const AGENT_REGISTRY_COPY_ABI =
    [
        {
            "type": "impl",
            "name": "AgentRegistryImpl",
            "interface_name": "contracts::IAgentRegistry"
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
            "type": "interface",
            "name": "contracts::IAgentRegistry",
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
                        }
                    ],
                    "outputs": [],
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
                    "name": "agent_class_hash",
                    "type": "core::starknet::class_hash::ClassHash"
                },
                {
                    "name": "tee",
                    "type": "core::starknet::contract_address::ContractAddress"
                },
                {
                    "name": "token",
                    "type": "core::starknet::contract_address::ContractAddress"
                }
            ]
        },
        {
            "type": "event",
            "name": "contracts::AgentRegistry::Event",
            "kind": "enum",
            "variants": []
        }
    ]

