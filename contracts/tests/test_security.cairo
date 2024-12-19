use starknet::{ContractAddress};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait,
};

use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

use teeception::IAgentRegistryDispatcher;
use teeception::IAgentRegistryDispatcherTrait;
use teeception::IAgentDispatcher;
use teeception::IAgentDispatcherTrait;
use teeception::{AgentRegistry, Agent};

fn deploy_registry(tee: ContractAddress, creator: ContractAddress) -> (ContractAddress, ContractAddress) {
    let token_class = declare('ERC20');
    let token_address = token_class
        .deploy(array![1000000_u256.into(), creator.into()])
        .unwrap();

    let registry_class = declare('AgentRegistry');
    let registry_address = registry_class
        .deploy(array![tee.into(), token_address.into()])
        .unwrap();

    (registry_address, token_address)
}

#[test]
#[should_panic(expected: ('Only tee can consume prompt',))]
fn test_unauthorized_prompt_consumption() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let unauthorized = starknet::contract_address_const::<0x456>();
    let prompt_price: u256 = 100;

    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    start_cheat_caller_address(token, creator);
    let token_dispatcher = IERC20Dispatcher { contract_address: token };
    token_dispatcher.approve(agent_address, prompt_price);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(agent.contract_address, creator);
    let prompt_id = agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);

    start_cheat_caller_address(agent.contract_address, unauthorized);
    agent.consume_prompt(prompt_id);
    stop_cheat_caller_address(agent.contract_address);
}

#[test]
#[should_panic(expected: ('Insufficient allowance',))]
fn test_unauthorized_token_transfer() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;

    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    start_cheat_caller_address(agent.contract_address, creator);
    agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);
}

#[test]
#[should_panic(expected: ('Only creator can reclaim',))]
fn test_unauthorized_prompt_reclaim() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let unauthorized = starknet::contract_address_const::<0x456>();
    let prompt_price: u256 = 100;

    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    start_cheat_caller_address(token, creator);
    let token_dispatcher = IERC20Dispatcher { contract_address: token };
    token_dispatcher.approve(agent_address, prompt_price);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(agent.contract_address, creator);
    let prompt_id = agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);

    start_cheat_caller_address(agent.contract_address, unauthorized);
    agent.reclaim_prompt(prompt_id);
    stop_cheat_caller_address(agent.contract_address);
}

#[test]
fn test_event_emission() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;

    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let mut spy = spy_events(registry.contract_address);

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    stop_cheat_caller_address(registry.contract_address);

    spy.assert_emitted(@array![
        (registry.contract_address, 'AgentRegistered', array![agent_address])
    ]);
}
