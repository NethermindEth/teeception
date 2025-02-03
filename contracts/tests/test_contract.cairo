use starknet::{ContractAddress, get_block_timestamp};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait,
    start_cheat_caller_address_global, stop_cheat_caller_address_global,
    start_cheat_block_timestamp_global, stop_cheat_block_timestamp_global,
};

use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin::security::pausable::PausableComponent;

use core::serde::{Serde};

use teeception::IAgentRegistryDispatcher;
use teeception::IAgentRegistryDispatcherTrait;
use teeception::IAgentDispatcher;
use teeception::IAgentDispatcherTrait;
use teeception::{AgentRegistry, Agent};

#[derive(Drop)]
struct TestSetup {
    tee: ContractAddress,
    creator: ContractAddress,
    prompt_price: u256,
    initial_balance: u256,
    registry_address: ContractAddress,
    token_address: ContractAddress,
    registry: IAgentRegistryDispatcher,
    token: IERC20Dispatcher,
    end_time: u64,
}

fn setup() -> TestSetup {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let initial_balance: u256 = 1000;
    let end_time = get_block_timestamp() + 3600; // 1 hour from now

    let agent_contract = declare("Agent").unwrap().contract_class();
    let registry_contract = declare("AgentRegistry").unwrap().contract_class();

    let token_address = deploy_test_token(creator);
    let token = IERC20Dispatcher { contract_address: token_address };

    let min_prompt_price: u256 = 1;
    let min_initial_balance: u256 = 1000;

    let mut calldata = ArrayTrait::<felt252>::new();
    creator.serialize(ref calldata);
    tee.serialize(ref calldata);
    agent_contract.serialize(ref calldata);

    start_cheat_caller_address_global(tee);
    let (registry_address, _) = registry_contract.deploy(@calldata).unwrap();
    stop_cheat_caller_address_global();

    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address_global(creator);
    registry.add_supported_token(token_address, min_prompt_price, min_initial_balance);
    let _ = token.approve(registry_address, min_initial_balance * 10);
    stop_cheat_caller_address_global();

    TestSetup {
        tee,
        creator,
        prompt_price,
        initial_balance,
        registry_address,
        token_address,
        registry,
        token,
        end_time,
    }
}

fn deploy_test_token(token_holder: ContractAddress) -> ContractAddress {
    let contract = declare("ERC20").unwrap().contract_class();
    let constructor_calldata = array![0, 1000000000000000000000000000, token_holder.into()];
    let (address, _) = contract.deploy(@constructor_calldata).unwrap();
    address.into()
}

fn deploy_registry_with_token(tee: ContractAddress) -> (ContractAddress, ContractAddress) {
    let token_contract = declare("ERC20").unwrap();
    let agent_contract = declare("Agent").unwrap();
    let registry_contract = declare("AgentRegistry").unwrap();
    
    // Deploy token first
    let mut token_calldata = ArrayTrait::new();
    let name = ByteArray::from_string("Test Token");
    let symbol = ByteArray::from_string("TST");
    let initial_supply: u256 = 1000000;
    let recipient = starknet::get_contract_address();
    
    name.serialize(ref token_calldata);
    symbol.serialize(ref token_calldata);
    initial_supply.serialize(ref token_calldata);
    recipient.serialize(ref token_calldata);
    
    let (token_address, _) = token_contract.deploy(@token_calldata).unwrap();

    // Deploy registry with token
    let mut registry_calldata = ArrayTrait::new();
    agent_contract.class_hash.serialize(ref registry_calldata);
    tee.serialize(ref registry_calldata);
    token_address.serialize(ref registry_calldata);
    
    let (registry_address, _) = registry_contract.deploy(@registry_calldata).unwrap();
    
    (registry_address, token_address)
}

#[test]
fn test_register_agent() {
    let setup = setup();
    let name = "test_agent";
    let system_prompt = "I am a test agent";

    let mut spy = spy_events();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            name.clone(),
            system_prompt.clone(),
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    assert(setup.registry.is_agent_registered(agent_address), 'Agent should be registered');

    let agents = setup.registry.get_agents(0, 2);
    assert(agents.len() == 1, 'Should have 1 agent');
    assert(*agents[0] == agent_address, 'Agent should be in the list');

    let agent = setup.registry.get_agent(0);
    assert(agent == agent_address, 'Agent should be in the list');

    let agent_dispatcher = IAgentDispatcher { contract_address: agent_address };
    assert(agent_dispatcher.get_name() == name.clone(), 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt.clone(), 'Wrong system prompt');
    assert(agent_dispatcher.get_creator() == setup.creator, 'Wrong creator');

    // Verify event was emitted
    spy
        .assert_emitted(
            @array![
                (
                    setup.registry.contract_address,
                    AgentRegistry::Event::AgentRegistered(
                        AgentRegistry::AgentRegistered {
                            agent: agent_address,
                            creator: setup.creator,
                            name: name.clone(),
                            system_prompt: system_prompt.clone(),
                            prompt_price: setup.prompt_price,
                            token: setup.token_address,
                            end_time: setup.end_time,
                        },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: ('Name already used',))]
fn test_register_agent_name_conflict() {
    let setup = setup();
    let name = "test_agent";
    let system_prompt = "Test Prompt";

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);

    // Register first agent
    setup
        .registry
        .register_agent(
            name.clone(),
            system_prompt,
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );

    // Try to register second agent with same name - should fail
    setup
        .registry
        .register_agent(
            name.clone(),
            "Different prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );

    stop_cheat_caller_address(setup.registry.contract_address);
}


#[test]
fn test_pay_for_prompt() {
    let setup = setup();

    // Register agent
    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Setup user with tokens
    let user = starknet::contract_address_const::<0x456>();
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, setup.prompt_price);
    stop_cheat_caller_address(setup.token.contract_address);

    // Approve token spending
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, setup.prompt_price);
    stop_cheat_caller_address(setup.token.contract_address);

    let mut spy = spy_events();

    assert(setup.token.allowance(user, agent_address) == setup.prompt_price, 'Wrong allowance');

    start_cheat_caller_address(agent_address, user);
    // Pay for prompt
    let tweet_id = 12345_u64;
    let prompt_id = agent.pay_for_prompt(tweet_id, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Verify event was emitted
    spy
        .assert_emitted(
            @array![
                (
                    agent_address,
                    Agent::Event::PromptPaid(
                        Agent::PromptPaid {
                            user: user,
                            prompt_id: prompt_id,
                            tweet_id: tweet_id,
                            prompt: "test prompt",
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_register_multiple_agents() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);

    let agent1_address = setup
        .registry
        .register_agent(
            "agent_1",
            "Prompt 1",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );

    let agent2_address = setup
        .registry
        .register_agent(
            "agent_2",
            "Prompt 2",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );

    stop_cheat_caller_address(setup.registry.contract_address);

    // Verify both agents have correct creator
    let agent1 = IAgentDispatcher { contract_address: agent1_address };
    let agent2 = IAgentDispatcher { contract_address: agent2_address };
    assert(agent1.get_creator() == setup.creator, 'Wrong creator for agent 1');
    assert(agent2.get_creator() == setup.creator, 'Wrong creator for agent 2');
}

#[test]
#[should_panic(expected: ('Only tee can consume',))]
fn test_unauthorized_transfer() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    // Should fail as we're not the TEE
    setup.registry.consume_prompt(agent_address, 1, starknet::contract_address_const::<0x789>());
}

#[test]
#[should_panic(expected: ('Only registry can call',))]
fn test_direct_agent_transfer_unauthorized() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Should fail as we're not the registry
    agent.consume_prompt(1, starknet::contract_address_const::<0x789>());
}

#[test]
fn test_get_agent_details() {
    let setup = setup();

    let name = "complex_agent";
    let system_prompt = "Complex system prompt with multiple words";

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            name.clone(),
            system_prompt.clone(),
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    assert(agent.get_name() == name, 'Wrong agent name');
    assert(agent.get_system_prompt() == system_prompt, 'Wrong system prompt');
}

#[test]
fn test_authorized_token_transfer() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Setup user with tokens and approve spending
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, setup.prompt_price);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, setup.prompt_price);
    stop_cheat_caller_address(setup.token.contract_address);

    // Pay for prompt
    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    let recipient = starknet::contract_address_const::<0x456>();

    // Record initial balances
    let initial_agent_balance = setup.token.balance_of(agent_address);
    let initial_recipient_balance = setup.token.balance_of(recipient);

    // Calculate expected fee splits
    let creator_fee = (setup.prompt_price * agent.CREATOR_REWARD_BPS().into())
        / agent.BPS_DENOMINATOR().into();
    let protocol_fee = (setup.prompt_price * agent.PROTOCOL_FEE_BPS().into())
        / agent.BPS_DENOMINATOR().into();
    let expected_recipient_amount = initial_agent_balance - creator_fee - protocol_fee;

    // Consume prompt through TEE
    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup.registry.consume_prompt(agent_address, prompt_id, recipient);
    stop_cheat_caller_address(setup.registry.contract_address);

    // Verify final balances
    assert(setup.token.balance_of(agent_address) == 0, 'Agent wrong balance');
    assert(
        setup.token.balance_of(recipient) == initial_recipient_balance + expected_recipient_amount,
        'Recipient wrong balance',
    );
}

#[test]
#[should_panic(expected: ('Only tee can consume',))]
fn test_unauthorized_token_transfer() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let amount: u256 = 100;
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(agent_address, amount);
    stop_cheat_caller_address(setup.token.contract_address);

    let unauthorized = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(setup.registry.contract_address, unauthorized);
    setup.registry.consume_prompt(agent_address, 1, unauthorized);
    stop_cheat_caller_address(setup.registry.contract_address);
}

#[test]
#[should_panic(expected: ('ERC20: insufficient allowance',))]
fn test_pay_for_prompt_without_approval() {
    let setup = setup();

    // Register agent
    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);
    let agent = IAgentDispatcher { contract_address: agent_address };

    // Try to pay for prompt without approval
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    agent.pay_for_prompt(12345, "test prompt");
}

#[test]
fn test_is_agent_registered() {
    let setup = setup();
    let random_address = starknet::contract_address_const::<0x456>();

    assert(!setup.registry.is_agent_registered(random_address), 'Should not be registered');

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test_agent",
            "Test Prompt",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    assert(setup.registry.is_agent_registered(agent_address), 'Should be registered');
}

#[test]
fn test_fee_distribution() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent("test", "test", setup.token_address, 100, 1000, setup.end_time);
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user and approve spending
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    let creator_initial = setup.token.balance_of(setup.creator);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup.registry.consume_prompt(agent_address, prompt_id, agent_address);
    stop_cheat_caller_address(setup.registry.contract_address);

    // Check creator received 20% (20 tokens)
    assert(setup.token.balance_of(setup.creator) == creator_initial + 20, 'Creator fee wrong');
}

#[test]
#[should_panic(expected: ('Too early to reclaim',))]
fn test_early_reclaim() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent("test", "test", setup.token_address, 100, 1000, setup.end_time);
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Setup funds
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    // Create prompt
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");

    // Try to reclaim immediately (should fail)
    agent.reclaim_prompt(prompt_id);
}

#[test]
fn test_paused_functionality() {
    let setup = setup();

    let mut spy = spy_events();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    setup.registry.pause();
    setup.registry.unpause();
    stop_cheat_caller_address(setup.registry.contract_address);

    spy
        .assert_emitted(
            @array![
                (
                    setup.registry_address,
                    AgentRegistry::Event::PausableEvent(
                        PausableComponent::Event::Paused(
                            PausableComponent::Paused { account: setup.creator },
                        ),
                    ),
                ),
                (
                    setup.registry_address,
                    AgentRegistry::Event::PausableEvent(
                        PausableComponent::Event::Unpaused(
                            PausableComponent::Unpaused { account: setup.creator },
                        ),
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: ('Token not supported',))]
fn test_unsupported_token_registration() {
    let setup = setup();

    let fake_token = deploy_test_token(setup.creator);

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    setup
        .registry
        .register_agent("test", "test", fake_token, 100, 1000, setup.end_time); // Should panic
}

#[test]
fn test_token_management() {
    let setup = setup();
    let new_token = deploy_test_token(setup.creator);

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    setup.registry.add_supported_token(new_token, 50, 500);
    assert(setup.registry.is_token_supported(new_token), 'Token should be supported');

    setup.registry.remove_supported_token(new_token);
    assert(!setup.registry.is_token_supported(new_token), 'Token should be removed');
    stop_cheat_caller_address(setup.registry.contract_address);
}

#[test]
fn test_prompt_lifecycle() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent("test", "test", setup.token_address, 100, 1000, setup.end_time);
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 1000);
    stop_cheat_caller_address(setup.token.contract_address);

    // Pay for prompt
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    let initial_count = agent.get_prompt_count();

    // Consume prompt
    start_cheat_caller_address(setup.registry_address, setup.tee);
    setup.registry.consume_prompt(agent_address, prompt_id, agent_address);
    stop_cheat_caller_address(setup.registry_address);

    assert(agent.get_prompt_count() == initial_count, 'Prompt count mismatch');
    assert(agent.get_user_tweet_prompt(user, 123, 0) == prompt_id, 'Prompt not consumed');

    let prompts = agent.get_user_tweet_prompts(user, 123, 0, 2);
    assert(prompts.len() == 1, 'Prompt not consumed');
    assert(*prompts[0] == prompt_id, 'Prompt not consumed');
}

#[test]
fn test_reclaim_after_delay() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent("test", "test", setup.token_address, 100, 1000, setup.end_time);
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Setup funds
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    // Create prompt
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Wait for RECLAIM_DELAY + 1s
    start_cheat_block_timestamp_global(get_block_timestamp() + agent.RECLAIM_DELAY() + 1);

    let initial_balance = setup.token.balance_of(user);

    start_cheat_caller_address(agent_address, user);
    agent.reclaim_prompt(prompt_id);
    stop_cheat_caller_address(agent_address);
    stop_cheat_block_timestamp_global();

    // Verify the tokens were returned
    assert(setup.token.balance_of(user) == initial_balance + 100, 'Tokens not reclaimed');

    let pending = agent.get_pending_prompt(prompt_id);
    assert(pending.amount == 0, 'Reclaim failed');
}

#[test]
#[should_panic(expected: ('Only tee can consume',))]
fn test_unauthorized_consumption() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent("test", "test", setup.token_address, 100, 1000, setup.end_time);
    stop_cheat_caller_address(setup.registry.contract_address);

    let hacker = starknet::contract_address_const::<0x456>();

    start_cheat_caller_address(setup.registry.contract_address, hacker);
    setup.registry.consume_prompt(agent_address, 1, hacker); // Should panic
}

#[test]
fn test_withdraw() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    // Pay for prompt
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Move time past end_time
    start_cheat_block_timestamp_global(setup.end_time + 1);

    let initial_creator_balance = setup.token.balance_of(setup.creator);
    let agent_balance = setup.token.balance_of(agent_address);
    let pool_prize = agent.get_prize_pool();

    // Creator withdraws funds
    start_cheat_caller_address(agent_address, setup.creator);
    agent.withdraw();
    stop_cheat_caller_address(agent_address);

    // Verify balances
    assert(
        setup.token.balance_of(agent_address) == agent_balance - pool_prize, 'Agent wrong balance',
    );
    assert(
        setup.token.balance_of(setup.creator) == initial_creator_balance + pool_prize,
        'Creator wrong balance',
    );
    assert(agent.get_is_drained(), 'Should be drained');

    stop_cheat_block_timestamp_global();
}

#[test]
#[should_panic(expected: ('Agent not been finalized',))]
fn test_early_withdraw() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Try to withdraw before end_time + reclaim delay
    start_cheat_caller_address(agent_address, setup.creator);
    agent.withdraw(); // Should fail
}

#[test]
#[should_panic(expected: ('Only creator can withdraw',))]
fn test_unauthorized_withdraw() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let unauthorized = starknet::contract_address_const::<0x456>();

    // Move time past end_time + reclaim delay
    start_cheat_block_timestamp_global(setup.end_time + agent.RECLAIM_DELAY() + 1);

    // Try to withdraw as unauthorized user
    start_cheat_caller_address(agent_address, unauthorized);
    agent.withdraw(); // Should fail
}

#[test]
#[should_panic(expected: ('Agent already been finalized',))]
fn test_pay_after_end() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    // Approve spending
    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    // Move time past end_time
    start_cheat_block_timestamp_global(setup.end_time + 1);

    // Try to pay after end_time
    start_cheat_caller_address(agent_address, user);
    agent.pay_for_prompt(123, "test prompt"); // Should fail
}

#[test]
fn test_is_finalized() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Initially not finalized
    assert(!agent.is_finalized(), 'Should not be finalized');
    assert(!agent.get_is_drained(), 'Should not be drained');

    // Move time past end_time
    start_cheat_block_timestamp_global(setup.end_time + 1);
    assert(agent.is_finalized(), 'Should be finalized by time');
    stop_cheat_block_timestamp_global();

    let user = starknet::contract_address_const::<0x456>();

    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Reset time and drain
    start_cheat_block_timestamp_global(setup.end_time - 1000);
    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup
        .registry
        .consume_prompt(agent_address, prompt_id, starknet::contract_address_const::<0x789>());
    stop_cheat_caller_address(setup.registry.contract_address);
    assert(agent.is_finalized(), 'Should be finalized by drain');
    assert(agent.get_is_drained(), 'Should be drained');
}

#[test]
#[should_panic(expected: ('Agent already been finalized',))]
fn test_consume_after_drain() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user and create prompt
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Drain the agent
    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup
        .registry
        .consume_prompt(agent_address, prompt_id, starknet::contract_address_const::<0x789>());
    stop_cheat_caller_address(setup.registry.contract_address);

    // Try to consume another prompt after drain
    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup
        .registry
        .consume_prompt(
            agent_address, 2, starknet::contract_address_const::<0x789>(),
        ); // Should fail
}

#[test]
fn test_withdraw_after_drain() {
    let setup = setup();

    start_cheat_caller_address(setup.registry.contract_address, setup.creator);
    let agent_address = setup
        .registry
        .register_agent(
            "test",
            "test",
            setup.token_address,
            setup.prompt_price,
            setup.initial_balance,
            setup.end_time,
        );
    stop_cheat_caller_address(setup.registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let user = starknet::contract_address_const::<0x456>();

    // Fund user and create prompt
    start_cheat_caller_address(setup.token.contract_address, setup.creator);
    setup.token.transfer(user, 200);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(setup.token.contract_address, user);
    setup.token.approve(agent_address, 100);
    stop_cheat_caller_address(setup.token.contract_address);

    start_cheat_caller_address(agent_address, user);
    let prompt_id = agent.pay_for_prompt(123, "test prompt");
    stop_cheat_caller_address(agent_address);

    // Drain the agent
    start_cheat_caller_address(setup.registry.contract_address, setup.tee);
    setup
        .registry
        .consume_prompt(agent_address, prompt_id, starknet::contract_address_const::<0x789>());
    stop_cheat_caller_address(setup.registry.contract_address);

    assert(agent.get_is_drained(), 'Should be drained');
    assert(agent.is_finalized(), 'Should be finalized');

    // Creator should be able to withdraw after drain
    start_cheat_caller_address(agent_address, setup.creator);
    agent.withdraw(); // Should succeed
}

#[test]
fn test_successful_agent_transfer() {
    // Deploy registry with token
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, token_address) = deploy_registry_with_token(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token = IERC20Dispatcher { contract_address: token_address };

    // Register an agent
    registry.register_agent(
        ByteArray::from_string("Test Agent"),
        ByteArray::from_string("Test Prompt")
    );
    
    let agents = registry.get_agents();
    let agent_address = *agents.at(0);
    
    // Send some tokens to the agent
    let agent_initial_balance: u256 = 100;
    token.transfer(agent_address, agent_initial_balance);
    
    // Verify agent received the tokens
    let balance_before = token.balance_of(agent_address);
    assert(balance_before == agent_initial_balance, 'Wrong initial balance');
    
    // Create a new recipient address
    let new_owner = starknet::contract_address_const::<0x123>();
    
    // Start spoofing the TEE address for the transfer
    starknet::testing::set_caller_address(tee);
    
    // Transfer the agent to a new address
    registry.transfer(agent_address, new_owner);
    
    // Verify tokens were transferred to new owner
    let balance_after_agent = token.balance_of(agent_address);
    let balance_after_new_owner = token.balance_of(new_owner);
    
    assert(balance_after_agent == 0, 'Agent should have 0 balance');
    assert(balance_after_new_owner == agent_initial_balance, 'New owner wrong balance');
}

#[test]
fn test_get_token_address() {
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, token_address) = deploy_registry_with_token(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    
    let stored_token = registry.get_token();
    assert(stored_token == token_address, 'Wrong token address');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_transfer_not_tee() {
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, _) = deploy_registry_with_token(tee);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    // Register an agent
    registry.register_agent(
        ByteArray::from_string("Test Agent"),
        ByteArray::from_string("Test Prompt")
    );
    
    let agents = registry.get_agents();
    let agent_address = *agents.at(0);
    
    // Try to transfer without being TEE
    starknet::testing::set_caller_address(starknet::contract_address_const::<0x999>());
    registry.transfer(
        agent_address,
        starknet::contract_address_const::<0x123>()
    );
}
