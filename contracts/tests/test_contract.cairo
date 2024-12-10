use starknet::{ContractAddress};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait,
    start_cheat_block_timestamp_global, start_cheat_caller_address_global,
    stop_cheat_caller_address_global,
};

use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use core::serde::{Serde};

use contracts::IAgentRegistryDispatcher;
use contracts::IAgentRegistryDispatcherTrait;
use contracts::IAgentDispatcher;
use contracts::IAgentDispatcherTrait;
use contracts::{AgentRegistry, Agent};

fn deploy_test_token(token_holder: ContractAddress) -> ContractAddress {
    let contract = declare("ERC20").unwrap().contract_class();
    let constructor_calldata = array![0, 1000000, token_holder.into()];
    let (address, _) = contract.deploy(@constructor_calldata).unwrap();
    address.into()
}

fn deploy_registry(tee: ContractAddress) -> (ContractAddress, ContractAddress) {
    let agent_contract = declare("Agent").unwrap().contract_class();

    let registry_contract = declare("AgentRegistry").unwrap().contract_class();

    let token = deploy_test_token(tee);

    let mut calldata = ArrayTrait::<felt252>::new();
    tee.serialize(ref calldata);
    agent_contract.serialize(ref calldata);
    token.serialize(ref calldata);

    start_cheat_caller_address_global(tee);
    let (registry_address, _) = registry_contract.deploy(@calldata).unwrap();
    stop_cheat_caller_address_global();

    (registry_address.into(), token)
}

#[test]
fn test_register_agent() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    let name = "Test Agent";
    let system_prompt = "I am a test agent";
    let end_time = 1234_u64;

    let mut spy = spy_events();

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent(name.clone(), system_prompt.clone(), prompt_price, end_time);
    stop_cheat_caller_address(registry.contract_address);

    assert(registry.is_agent_registered(agent_address), 'Agent should be registered');

    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };
    assert(agent_dispatcher.get_name() == name.clone(), 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt.clone(), 'Wrong system prompt');
    assert(agent_dispatcher.get_creator() == creator, 'Wrong creator');
    assert(agent_dispatcher.get_end_time() == end_time, 'Wrong end time');

    // Verify event was emitted
    spy
        .assert_emitted(
            @array![
                (
                    registry.contract_address,
                    AgentRegistry::Event::AgentRegistered(
                        AgentRegistry::AgentRegistered {
                            agent: agent_address, creator, name: name.clone(),
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_pay_for_prompt() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register agent
    let creator = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, end_time);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Setup user with tokens
    let user = starknet::contract_address_const::<0x456>();
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(user, prompt_price);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    // Approve token spending
    start_cheat_caller_address(token_dispatcher.contract_address, user);
    println!("prompt price: {}", prompt_price);
    token_dispatcher.approve(agent_address, prompt_price);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    start_cheat_caller_address(agent_address, user);
    // check allowance
    assert(token_dispatcher.allowance(user, agent_address) == prompt_price, 'Wrong allowance');

    let mut spy = spy_events();

    // Pay for prompt
    let twitter_message_id = 12345_u64;
    agent.pay_for_prompt(twitter_message_id);
    stop_cheat_caller_address(agent_address);

    // Calculate expected splits
    let creator_fee = (prompt_price * 2000) / 10000; // 20%
    let agent_amount = prompt_price - creator_fee;

    // Verify token transfers
    assert(token_dispatcher.balance_of(agent_address) == agent_amount, 'Wrong agent balance');
    assert(token_dispatcher.balance_of(creator) == creator_fee, 'Wrong creator fee');
    assert(token_dispatcher.balance_of(user) == 0, 'Wrong user balance');

    // Verify event was emitted
    spy
        .assert_emitted(
            @array![
                (
                    agent_address,
                    Agent::Event::PromptPaid(
                        Agent::PromptPaid {
                            user: user,
                            twitter_message_id: twitter_message_id,
                            amount: agent_amount,
                            creator_fee: creator_fee,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_register_multiple_agents() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;
    start_cheat_caller_address(registry.contract_address, creator);

    let agent1_address = registry.register_agent("Agent 1", "Prompt 1", prompt_price, end_time);

    let agent2_address = registry.register_agent("Agent 2", "Prompt 2", prompt_price, end_time);

    stop_cheat_caller_address(registry.contract_address);

    // Verify both agents have correct creator
    let agent1 = IAgentDispatcher { contract_address: agent1_address };
    let agent2 = IAgentDispatcher { contract_address: agent2_address };
    assert(agent1.get_creator() == creator, 'Wrong creator for agent 1');
    assert(agent2.get_creator() == creator, 'Wrong creator for agent 2');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);

    // Should fail as we're not the TEE
    registry.transfer(agent_address, starknet::contract_address_const::<0x789>());
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_direct_agent_transfer_unauthorized() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Should fail as we're not the registry
    agent.transfer(starknet::contract_address_const::<0x789>());
}

#[test]
fn test_get_agent_details() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let name = "Complex Agent";
    let system_prompt = "Complex system prompt with multiple words";

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent(name.clone(), system_prompt.clone(), prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    assert(agent.get_name() == name, 'Wrong agent name');
    assert(agent.get_system_prompt() == system_prompt, 'Wrong system prompt');
}

#[test]
fn test_authorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);

    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == amount, 'Wrong initial balance');

    let recipient = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, tee);
    registry.transfer(agent_address, recipient);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == 0, 'Agent should have 0');
    assert(token_dispatcher.balance_of(recipient) == amount, 'Recipient wrong balance');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);

    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let unauthorized = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, unauthorized);
    registry.transfer(agent_address, unauthorized);
    stop_cheat_caller_address(registry.contract_address);
}

#[test]
#[should_panic(expected: ('ERC20: insufficient allowance',))]
fn test_pay_for_prompt_without_approval() {
    let tee = starknet::contract_address_const::<0x1>();
    let depositor = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register agent
    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    stop_cheat_caller_address(registry.contract_address);
    let agent = IAgentDispatcher { contract_address: agent_address };

    // Try to pay for prompt without approval
    start_cheat_caller_address(token_dispatcher.contract_address, depositor);
    agent.pay_for_prompt(12345);
}

#[test]
fn test_is_agent_registered() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let random_address = starknet::contract_address_const::<0x456>();
    assert(!registry.is_agent_registered(random_address), 'Should not be registered');

    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, 1234_u64);
    assert(registry.is_agent_registered(agent_address), 'Should be registered');
}

#[test]
fn test_creator_can_transfer_after_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let end_time = 1234_u64;

    let (registry_address, token) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, end_time);
    stop_cheat_caller_address(registry.contract_address);
    let agent = IAgentDispatcher { contract_address: agent_address };

    // Fund the agent
    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp after end_time
    start_cheat_block_timestamp_global(end_time + 1);

    // Creator should be able to transfer
    start_cheat_caller_address(agent.contract_address, creator);
    agent.transfer(recipient);
    stop_cheat_caller_address(agent.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == 0, 'Agent should have 0');
    assert(token_dispatcher.balance_of(recipient) == amount, 'Recipient wrong balance');
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_creator_cannot_transfer_before_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;
    let prompt_price: u256 = 100;

    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, end_time);
    stop_cheat_caller_address(registry.contract_address);
    let agent = IAgentDispatcher { contract_address: agent_address };

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp before end_time
    start_cheat_block_timestamp_global(end_time - 1);

    // Creator should not be able to transfer
    start_cheat_caller_address(agent.contract_address, creator);
    agent.transfer(recipient);
}

#[test]
#[should_panic(expected: ('Only creator can transfer',))]
fn test_registry_cannot_transfer_after_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let end_time = 1234_u64;

    let (registry_address, _) = deploy_registry(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry
        .register_agent("Test Agent", "Test Prompt", prompt_price, end_time);
    stop_cheat_caller_address(registry.contract_address);

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp after end_time
    start_cheat_block_timestamp_global(end_time + 1);

    // Registry should not be able to transfer
    start_cheat_caller_address(registry.contract_address, tee);
    registry.transfer(agent_address, recipient);
}
