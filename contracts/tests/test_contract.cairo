use starknet::ContractAddress;
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};

use contracts::IAgentRegistryDispatcher;
use contracts::IAgentRegistryDispatcherTrait;
use contracts::IAgentDispatcher;
use contracts::IAgentDispatcherTrait;
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
    
    let (registry_address, _) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let name = "Test Agent";
    let system_prompt = "I am a test agent";
    
    dispatcher.register_agent(name.clone(), system_prompt.clone());
    
    let agents = dispatcher.get_agents();
    assert(agents.len() == 1, 'Should have one agent');
    
    let agent_dispatcher = IAgentDispatcher { contract_address: *agents.at(0) };
    assert(agent_dispatcher.get_name() == name.clone(), 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt.clone(), 'Wrong system prompt');
}

#[test]
fn test_register_multiple_agents() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    dispatcher.register_agent(
        "Agent 1",
        "Prompt 1"
    );

    dispatcher.register_agent(
        "Agent 2",
        "Prompt 2"
    );
    
    let agents = dispatcher.get_agents();
    
    assert(agents.len() == 2, 'Should have two agents');
}

#[test]
#[should_panic(expected: ('Only tee can transfer',))]
fn test_unauthorized_transfer() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    dispatcher.register_agent(
        "Test Agent",
        "Test Prompt"
    );
    
    let agents = dispatcher.get_agents();
    let agent_address = *agents.at(0);
    
    // Should fail as we're not the signer
    dispatcher.transfer(
        agent_address,
        starknet::contract_address_const::<0x123>()
    );
}

#[test]
#[should_panic(expected: ('Only registry can transfer',))]
fn test_direct_agent_transfer_unauthorized() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    dispatcher.register_agent(
        "Test Agent",
        "Test Prompt"
    );
    
    let agents = dispatcher.get_agents();
    let agent_dispatcher = IAgentDispatcher { contract_address: *agents.at(0) };
    
    // Should fail as we're not the registry
    agent_dispatcher.transfer(starknet::contract_address_const::<0x123>());
}

#[test]
fn test_get_agent_details() {
    let (registry_address, _) = deploy_registry(starknet::contract_address_const::<0x1>());
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };

    let name = "Complex Agent";
    let system_prompt = "Complex system prompt with multiple words";
    
    dispatcher.register_agent(name.clone(), system_prompt.clone());
    
    let agents = dispatcher.get_agents();
    let agent_dispatcher = IAgentDispatcher { contract_address: *agents.at(0) };
    
    assert(agent_dispatcher.get_name() == name, 'Wrong agent name');
    assert(agent_dispatcher.get_system_prompt() == system_prompt, 'Wrong system prompt');
}

#[test]
fn test_authorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let (registry_address, token) = deploy_registry(tee);
    let dispatcher = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    dispatcher.register_agent(
        "Test Agent",
        "Test Prompt"
    );
    
    let agents = dispatcher.get_agents();
    let agent_address = *agents.at(0);
    
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

    dispatcher.register_agent(
        "Test Agent",
        "Test Prompt"
    );
    
    let agents = dispatcher.get_agents();
    let agent_address = *agents.at(0);
    
    let amount: u256 = 100;
    start_cheat_caller_address(token_dispatcher.contract_address, tee);
    token_dispatcher.transfer(agent_address, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);

    let unauthorized = starknet::contract_address_const::<0x123>();
    start_cheat_caller_address(dispatcher.contract_address, unauthorized);
    dispatcher.transfer(agent_address, unauthorized);
    stop_cheat_caller_address(dispatcher.contract_address);
}
