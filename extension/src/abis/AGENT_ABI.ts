export const AGENT_ABI =
    [
        {
            "type": "impl",
            "name": "AgentImpl",
            "interface_name": "teeception::IAgent"
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
            "type": "struct",
            "name": "teeception::PendingPrompt",
            "members": [
                {
                    "name": "reclaimer",
                    "type": "core::starknet::contract_address::ContractAddress"
                },
                {
                    "name": "amount",
                    "type": "core::integer::u256"
                },
                {
                    "name": "timestamp",
                    "type": "core::integer::u64"
                }
            ]
        },
        {
            "type": "interface",
            "name": "teeception::IAgent",
            "items": [
                {
                    "type": "function",
                    "name": "pay_for_prompt",
                    "inputs": [
                        {
                            "name": "tweet_id",
                            "type": "core::integer::u64"
                        },
                        {
                            "name": "prompt",
                            "type": "core::byte_array::ByteArray"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "external"
                },
                {
                    "type": "function",
                    "name": "reclaim_prompt",
                    "inputs": [
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
                    "name": "consume_prompt",
                    "inputs": [
                        {
                            "name": "prompt_id",
                            "type": "core::integer::u64"
                        },
                        {
                            "name": "drain_to",
                            "type": "core::starknet::contract_address::ContractAddress"
                        }
                    ],
                    "outputs": [],
                    "state_mutability": "external"
                },
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
                    "name": "get_creator",
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
                    "name": "get_prompt_price",
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
                    "name": "get_registry",
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
                    "name": "get_next_prompt_id",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_pending_prompt",
                    "inputs": [
                        {
                            "name": "prompt_id",
                            "type": "core::integer::u64"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "teeception::PendingPrompt"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_prompt_count",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_user_tweet_prompt",
                    "inputs": [
                        {
                            "name": "user",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "tweet_id",
                            "type": "core::integer::u64"
                        },
                        {
                            "name": "idx",
                            "type": "core::integer::u64"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_user_tweet_prompts_count",
                    "inputs": [
                        {
                            "name": "user",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "tweet_id",
                            "type": "core::integer::u64"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "get_user_tweet_prompts",
                    "inputs": [
                        {
                            "name": "user",
                            "type": "core::starknet::contract_address::ContractAddress"
                        },
                        {
                            "name": "tweet_id",
                            "type": "core::integer::u64"
                        },
                        {
                            "name": "start",
                            "type": "core::integer::u64"
                        },
                        {
                            "name": "end",
                            "type": "core::integer::u64"
                        }
                    ],
                    "outputs": [
                        {
                            "type": "core::array::Array::<core::integer::u64>"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "RECLAIM_DELAY",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u64"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "PROMPT_REWARD_BPS",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u16"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "CREATOR_REWARD_BPS",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u16"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "PROTOCOL_FEE_BPS",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u16"
                        }
                    ],
                    "state_mutability": "view"
                },
                {
                    "type": "function",
                    "name": "BPS_DENOMINATOR",
                    "inputs": [],
                    "outputs": [
                        {
                            "type": "core::integer::u16"
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
                    "name": "name",
                    "type": "core::byte_array::ByteArray"
                },
                {
                    "name": "registry",
                    "type": "core::starknet::contract_address::ContractAddress"
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
                },
                {
                    "name": "creator",
                    "type": "core::starknet::contract_address::ContractAddress"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::Agent::PromptPaid",
            "kind": "struct",
            "members": [
                {
                    "name": "user",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "key"
                },
                {
                    "name": "prompt_id",
                    "type": "core::integer::u64",
                    "kind": "key"
                },
                {
                    "name": "tweet_id",
                    "type": "core::integer::u64",
                    "kind": "key"
                },
                {
                    "name": "prompt",
                    "type": "core::byte_array::ByteArray",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::Agent::PromptConsumed",
            "kind": "struct",
            "members": [
                {
                    "name": "prompt_id",
                    "type": "core::integer::u64",
                    "kind": "key"
                },
                {
                    "name": "amount",
                    "type": "core::integer::u256",
                    "kind": "data"
                },
                {
                    "name": "creator_fee",
                    "type": "core::integer::u256",
                    "kind": "data"
                },
                {
                    "name": "protocol_fee",
                    "type": "core::integer::u256",
                    "kind": "data"
                },
                {
                    "name": "drained_to",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::Agent::PromptReclaimed",
            "kind": "struct",
            "members": [
                {
                    "name": "prompt_id",
                    "type": "core::integer::u64",
                    "kind": "key"
                },
                {
                    "name": "amount",
                    "type": "core::integer::u256",
                    "kind": "data"
                },
                {
                    "name": "reclaimer",
                    "type": "core::starknet::contract_address::ContractAddress",
                    "kind": "data"
                }
            ]
        },
        {
            "type": "event",
            "name": "teeception::Agent::Event",
            "kind": "enum",
            "variants": [
                {
                    "name": "PromptPaid",
                    "type": "teeception::Agent::PromptPaid",
                    "kind": "nested"
                },
                {
                    "name": "PromptConsumed",
                    "type": "teeception::Agent::PromptConsumed",
                    "kind": "nested"
                },
                {
                    "name": "PromptReclaimed",
                    "type": "teeception::Agent::PromptReclaimed",
                    "kind": "nested"
                }
            ]
        }
    ]