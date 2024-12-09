use starknet::{ContractAddress, get_block_timestamp};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait,
    start_cheat_block_timestamp_global,
};

use contracts::IAgentRegistryDispatcher;
use contracts::IAgentRegistryDispatcherTrait;
use contracts::IAgentDispatcher;
use contracts::IAgentDispatcherTrait;
use contracts::Agent;
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use core::serde::{Serde};

fn deploy_test_token(token_holder: ContractAddress) -> ContractAddress {
    let contract = declare("ERC20").unwrap().contract_class();
    let constructor_calldata = array![0, 1000000, token_holder.into()];
    let (address, _) = contract.deploy(@constructor_calldata).unwrap();
    address.into()
}

fn deploy_registry(tee: ContractAddress) -> (ContractAddress, ContractAddress) {
    let agent_contract = declare("Agent").unwrap().contract_class();

    let registry_contract = declare("AgentRegistry").unwrap().contract_class();

    let token = deploy_test_token(0x1.try_into().unwrap());

    let mut calldata = ArrayTrait::<felt252>::new();
    agent_contract.serialize(ref calldata);
    tee.serialize(ref calldata);
    token.serialize(ref calldata);

    let (registry_address, _) = registry_contract.deploy(@calldata).unwrap();

    (registry_address.into(), token)
}

#[test]
fn test_register_agent() {
    let tee = starknet::contract_address_const::<0x1>();
    let owner = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;

    let (registry_address, _) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let name = "Test Agent";
    let system_prompt = "I am a test agent";

    let agent_address = dispatcher
        .register_agent(name.clone(), system_prompt.clone(), 1000_u256, end_time, owner);

    assert(dispatcher.is_agent_registered(agent_address), 'Agent should be registered');

    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };
    assert(agent_dispatcher.get_name() == name.clone(), 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt.clone(), 'Wrong system prompt');
    assert(agent_dispatcher.get_owner() == owner, 'Wrong owner');
    assert(agent_dispatcher.get_end_time() == end_time, 'Wrong end time');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_transfer() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);

    // Should fail as we're not the signer
    dispatcher.transfer(agent_address, starknet::contract_address_const::<0x123>());
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_direct_agent_transfer_unauthorized() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let timestamp = get_block_timestamp();
    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, timestamp + 1, owner);

    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    // Should fail as we're not the registry
    agent_dispatcher.transfer(starknet::contract_address_const::<0x123>());
}

#[test]
fn test_get_agent_details() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let name = "Complex Agent";
    let system_prompt = "Complex system prompt with multiple words";

    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent(name.clone(), system_prompt.clone(), 1000_u256, 1234_u64, owner);

    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    assert(agent_dispatcher.get_name() == name, 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt, 'Wrong system prompt');
}

#[test]
fn test_authorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);

    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == amount, 'Wrong initial balance');

    let recipient = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(dispatcher.contract_address, tee);
    dispatcher.transfer(agent_address, recipient);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == 0, 'Agent should have 0');
    assert(token_dispatcher.balance_of(recipient) == amount, 'Recipient wrong balance');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);

    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let unauthorized = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(dispatcher.contract_address, unauthorized);
    dispatcher.transfer(agent_address, unauthorized);
    stop_cheat_caller_address(dispatcher.contract_address);
}

#[test]
fn test_deposit_with_tweet() {
    let tee = starknet::contract_address_const::<0x1>();
    let depositor = starknet::contract_address_const::<0x123>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register an agent
    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    // Setup deposit amount and approve tokens
    let deposit_amount = agent_dispatcher.get_deposit_amount();

    // Fund the depositor
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(depositor, deposit_amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    // Approve spending
    start_cheat_caller_address(token_dispatcher.contract_address, depositor);
    token_dispatcher.approve(agent_address, deposit_amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let mut spy = spy_events();
    let tweet_id = 12345;

    start_cheat_caller_address(agent_dispatcher.contract_address, depositor);
    agent_dispatcher.deposit(tweet_id);
    stop_cheat_caller_address(agent_dispatcher.contract_address);

    // Verify balances
    assert(
        token_dispatcher.balance_of(agent_address) == deposit_amount,
        'Wrong ag balance after deposit',
    );
    assert(token_dispatcher.balance_of(depositor) == 0, 'Wrong dep balance after deposit');

    // Verify event emission
    spy
        .assert_emitted(
            @array![
                (
                    agent_address,
                    Agent::Event::Deposit(
                        Agent::Deposit { depositor: depositor, tweet_id: tweet_id },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: ('ERC20: insufficient allowance',))]
fn test_deposit_without_approval() {
    let tee = starknet::contract_address_const::<0x1>();
    let depositor = starknet::contract_address_const::<0x123>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register agent
    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    // Try to deposit without approval
    start_cheat_caller_address(token_dispatcher.contract_address, depositor);
    agent_dispatcher.deposit(12345);
}

#[test]
fn test_multiple_deposits_same_agent() {
    let tee = starknet::contract_address_const::<0x1>();
    let depositor1 = starknet::contract_address_const::<0x123>();
    let depositor2 = starknet::contract_address_const::<0x456>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register agent
    let owner = starknet::contract_address_const::<0x123>();
    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };
    let deposit_amount = agent_dispatcher.get_deposit_amount();

    // Fund both depositors
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(depositor1, deposit_amount);
    token_dispatcher.transfer(depositor2, deposit_amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    // First deposit
    start_cheat_caller_address(token_dispatcher.contract_address, depositor1);
    token_dispatcher.approve(agent_address, deposit_amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);
    start_cheat_caller_address(agent_dispatcher.contract_address, depositor1);
    agent_dispatcher.deposit(12345);
    stop_cheat_caller_address(agent_dispatcher.contract_address);

    // Second deposit
    start_cheat_caller_address(token_dispatcher.contract_address, depositor2);
    token_dispatcher.approve(agent_address, deposit_amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);
    start_cheat_caller_address(agent_dispatcher.contract_address, depositor2);
    agent_dispatcher.deposit(67890);
    stop_cheat_caller_address(agent_dispatcher.contract_address);

    // Verify final balance
    assert(
        token_dispatcher.balance_of(agent_address) == deposit_amount * 2,
        'Wrong final agent balance',
    );
}

#[test]
fn test_is_agent_registered() {
    let tee = starknet::contract_address_const::<0x1>();
    let owner = starknet::contract_address_const::<0x123>();
    let (registry_address, _) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let random_address = starknet::contract_address_const::<0x456>();
    assert(!dispatcher.is_agent_registered(random_address), 'Should not be registered');

    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, 1234_u64, owner);
    assert(dispatcher.is_agent_registered(agent_address), 'Should be registered');
}

#[test]
fn test_owner_can_transfer_after_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let owner = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;

    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, end_time, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    // Fund the agent
    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp after end_time
    start_cheat_block_timestamp_global(end_time + 1);

    // Owner should be able to transfer
    start_cheat_caller_address(agent_dispatcher.contract_address, owner);
    agent_dispatcher.transfer(recipient);
    stop_cheat_caller_address(agent_dispatcher.contract_address);

    assert(token_dispatcher.balance_of(agent_address) == 0, 'Agent should have 0');
    assert(token_dispatcher.balance_of(recipient) == amount, 'Recipient wrong balance');
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_owner_cannot_transfer_before_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let owner = starknet::contract_address_const::<0x123>();
    let end_time = 1234_u64;

    let (registry_address, _) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, end_time, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp before end_time
    start_cheat_block_timestamp_global(end_time - 1);

    // Owner should not be able to transfer
    start_cheat_caller_address(agent_dispatcher.contract_address, owner);
    agent_dispatcher.transfer(recipient);
}

#[test]
#[should_panic(expected: ('Only owner can transfer',))]
fn test_registry_cannot_transfer_before_end_time() {
    let tee = starknet::contract_address_const::<0x1>();
    let owner = starknet::contract_address_const::<0x123>();
    let end_time = get_block_timestamp();

    let (registry_address, _) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let agent_address = dispatcher
        .register_agent("Test Agent", "Test Prompt", 1000_u256, end_time, owner);
    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };

    let recipient = starknet::contract_address_const::<0x456>();

    // Set block timestamp after end_time
    start_cheat_block_timestamp_global(end_time + 1);

    // Registry should not be able to transfer
    start_cheat_caller_address(dispatcher.contract_address, registry_address);
    agent_dispatcher.transfer(recipient);
}
