use starknet::ContractAddress;
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address, start_cheat_caller_address_global, stop_cheat_caller_address_global, spy_events, EventSpyTrait, EventSpyAssertionsTrait };

use contracts::IAgentRegistryDispatcher;
use contracts::IAgentRegistryDispatcherTrait;
use contracts::IAgentDispatcher;
use contracts::IAgentDispatcherTrait;
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use core::serde::{Serde};
use contracts::{AgentRegistry, Agent};

fn deploy_test_token(token_holder: ContractAddress) -> ContractAddress {
    let contract = declare("ERC20").unwrap().contract_class();
    let constructor_calldata = array![0, 1000000, token_holder.into()];
    let (address, _) = contract.deploy(@constructor_calldata).unwrap();
    address.into()
}

fn deploy_registry(tee: ContractAddress, prompt_price: u256) -> (ContractAddress, ContractAddress) {
    let agent_contract = declare("Agent").unwrap().contract_class();

    let registry_contract = declare("AgentRegistry").unwrap().contract_class();
    
    let token = deploy_test_token(tee);
    
    let mut calldata = ArrayTrait::<felt252>::new();
    agent_contract.serialize(ref calldata);
    token.serialize(ref calldata);
    prompt_price.serialize(ref calldata);
    
    start_cheat_caller_address_global(tee);
    let (registry_address, _) = registry_contract.deploy(@calldata).unwrap();
    stop_cheat_caller_address_global();

    (registry_address.into(), token)
}

#[test]
fn test_register_agent() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee, prompt_price);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    let name = "Test Agent";
    let system_prompt = "I am a test agent";
    
    start_cheat_caller_address(registry.contract_address, creator);
    registry.register_agent(name.clone(), system_prompt.clone());
    stop_cheat_caller_address(registry.contract_address);
    
    let agents = registry.get_agents();
    assert(agents.len() == 1, 'Should have one agent');
    
    let agent_dispatcher = IAgentDispatcher { contract_address: *agents.at(0) };
    assert(agent_dispatcher.get_name() == name.clone(), 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt.clone(), 'Wrong system prompt');
    assert(agent_dispatcher.get_creator() == creator, 'Wrong creator');
    // Verify event was emitted
    let mut spy = spy_events();
    spy.assert_emitted(
        @array![
            (
                registry.contract_address,
                AgentRegistry::Event::AgentRegistered(
                    AgentRegistry::AgentRegistered {
                        agent: *agents.at(0),
                        creator,
                        name: name.clone()
                    }
                )
            )
        ]
    );
}

#[test]
fn test_pay_for_prompt() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, prompt_price);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Register agent
    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    registry.register_agent("Test Agent", "Test Prompt");
    stop_cheat_caller_address(registry.contract_address);
    
    let agents = registry.get_agents();
    let agent_address = *agents.at(0);
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
    let mut spy = spy_events();
    let events = spy.get_events();
    let mut serialized_events = ArrayTrait::<felt252>::new();
    events.serialize(ref serialized_events);

    println!("events: {}", serialized_events.at(0));
    spy.assert_emitted(
        @array![
            (
                agent_address,
                Agent::Event::PromptPaid(
                    Agent::PromptPaid {
                        user: user,
                        twitter_message_id: twitter_message_id,
                        amount: agent_amount,
                        creator_fee: creator_fee,
                    }
                )
            )
        ]
    );
}

#[test]
fn test_register_multiple_agents() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee, prompt_price);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);

    registry.register_agent(
        "Agent 1",
        "Prompt 1"
    );

    registry.register_agent(
        "Agent 2",
        "Prompt 2"
    );
    
    stop_cheat_caller_address(registry.contract_address);
    
    let agents = registry.get_agents();
    assert(agents.len() == 2, 'Should have two agents');

    // Verify both agents have correct creator
    let agent1 = IAgentDispatcher { contract_address: *agents.at(0) };
    let agent2 = IAgentDispatcher { contract_address: *agents.at(1) };
    assert(agent1.get_creator() == creator, 'Wrong creator for agent 1');
    assert(agent2.get_creator() == creator, 'Wrong creator for agent 2');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee, prompt_price);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    registry.register_agent("Test Agent", "Test Prompt");
    stop_cheat_caller_address(registry.contract_address);
    
    let agents = registry.get_agents();
    let agent_address = *agents.at(0);
    
    // Should fail as we're not the TEE
    registry.transfer(agent_address, starknet::contract_address_const::<0x789>());
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_direct_agent_transfer_unauthorized() {
    let tee = starknet::contract_address_const::<0x1>();
    let prompt_price: u256 = 100;
    let (registry_address, _) = deploy_registry(tee, prompt_price);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let creator = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(registry.contract_address, creator);
    registry.register_agent("Test Agent", "Test Prompt");
    stop_cheat_caller_address(registry.contract_address);
    
    let agents = registry.get_agents();
    let agent = IAgentDispatcher { contract_address: *agents.at(0) };
    
    // Should fail as we're not the registry
    agent.transfer(starknet::contract_address_const::<0x789>());
}
