export const AGENT_ABI =
    [
        {
            "type": "impl",
            "name": "AgentImpl",
            "interface_name": "contracts::IAgent"
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
            "name": "contracts::IAgent",
            "items": [
                {
                    "type": "function",
                    "name": "get_system_prompt",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::byte_array::ByteArray"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_name",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::byte_array::ByteArray"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "transfer",
                    "inputs": [
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
                    "name": "name",
                    "type": "core::byte_array::ByteArray"
                },
                {
                    "name": "system_prompt",
                    "type": "core::byte_array::ByteArray"
                }
            ]
        },
        {
            "type": "event",
            "name": "contracts::Agent::Event",
            "kind": "enum",
            "variants": []
        }
    ]
