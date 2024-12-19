use starknet::{ContractAddress};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait,
};

use openzeppelin::security::pausable::interface::{IPausableDispatcher, IPausableDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

use teeception::IAgentRegistryDispatcher;
use teeception::IAgentRegistryDispatcherTrait;
use teeception::IAgentDispatcher;
use teeception::IAgentDispatcherTrait;
use teeception::{AgentRegistry, Agent};

fn deploy_registry(tee: ContractAddress, creator: ContractAddress) -> (ContractAddress, ContractAddress) {
    // Deploy ERC20 token
    let token_class = declare('ERC20');
    let token_address = token_class
        .deploy(array![1000000_u256.into(), creator.into()])
        .unwrap();

    // Deploy registry
    let registry_class = declare('AgentRegistry');
    let registry_address = registry_class
        .deploy(array![tee.into(), token_address.into()])
        .unwrap();

    (registry_address, token_address)
}

#[test]
fn test_pause_registry() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Test pause functionality
    start_cheat_caller_address(registry.contract_address, tee);
    registry.pause();
    stop_cheat_caller_address(registry.contract_address);

    // Verify operations fail when paused
    start_cheat_caller_address(registry.contract_address, creator);
    let mut success = false;
    match registry.register_agent("Test Agent", "Test Prompt", prompt_price) {
        Result::Ok(_) => {},
        Result::Err(_) => { success = true; }
    };
    assert(success, 'Should fail when paused');
    stop_cheat_caller_address(registry.contract_address);

    // Test unpause functionality
    start_cheat_caller_address(registry.contract_address, tee);
    registry.unpause();
    stop_cheat_caller_address(registry.contract_address);

    // Verify operations work after unpause
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    assert(registry.is_agent_registered(agent_address), 'Should work after unpause');
    stop_cheat_caller_address(registry.contract_address);
}

#[test]
#[should_panic(expected: ('Only tee can pause',))]
fn test_unauthorized_pause() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let unauthorized = starknet::contract_address_const::<0x456>();
    let (registry_address, _) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    // Try to pause with unauthorized account
    start_cheat_caller_address(registry.contract_address, unauthorized);
    registry.pause();
    stop_cheat_caller_address(registry.contract_address);
}

#[test]
#[should_panic(expected: ('Only tee can unpause',))]
fn test_unauthorized_unpause() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let unauthorized = starknet::contract_address_const::<0x456>();
    let (registry_address, _) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    // Pause with authorized account
    start_cheat_caller_address(registry.contract_address, tee);
    registry.pause();
    stop_cheat_caller_address(registry.contract_address);

    // Try to unpause with unauthorized account
    start_cheat_caller_address(registry.contract_address, unauthorized);
    registry.unpause();
    stop_cheat_caller_address(registry.contract_address);
}
