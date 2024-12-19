use starknet::{ContractAddress, get_block_timestamp};
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait, start_warp, stop_warp,
};

use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

use teeception::IAgentRegistryDispatcher;
use teeception::IAgentRegistryDispatcherTrait;
use teeception::IAgentDispatcher;
use teeception::IAgentDispatcherTrait;
use teeception::{AgentRegistry, Agent};

const RECLAIM_DELAY: u64 = 24 * 60 * 60; // 24 hours in seconds

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

fn setup_agent_with_prompt(
    registry: IAgentRegistryDispatcher, token: ContractAddress, creator: ContractAddress, prompt_price: u256
) -> (ContractAddress, u64) {
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

    (agent_address, prompt_id)
}

#[test]
#[should_panic(expected: ('Too early to reclaim',))]
fn test_reclaim_prompt_too_early() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let (agent_address, prompt_id) = setup_agent_with_prompt(registry, token, creator, prompt_price);
    let agent = IAgentDispatcher { contract_address: agent_address };

    start_cheat_caller_address(agent.contract_address, creator);
    agent.reclaim_prompt(prompt_id);
    stop_cheat_caller_address(agent.contract_address);
}

#[test]
fn test_reclaim_prompt_after_delay() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let (agent_address, prompt_id) = setup_agent_with_prompt(registry, token, creator, prompt_price);
    let agent = IAgentDispatcher { contract_address: agent_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    let initial_creator_balance = token_dispatcher.balance_of(creator);
    let initial_agent_balance = token_dispatcher.balance_of(agent_address);

    let current_time = get_block_timestamp();
    start_warp(current_time + RECLAIM_DELAY + 1);

    start_cheat_caller_address(agent.contract_address, creator);
    agent.reclaim_prompt(prompt_id);
    stop_cheat_caller_address(agent.contract_address);

    stop_warp();

    let final_creator_balance = token_dispatcher.balance_of(creator);
    let final_agent_balance = token_dispatcher.balance_of(agent_address);

    assert(
        final_creator_balance - initial_creator_balance == prompt_price,
        'Creator should receive full amount'
    );
    assert(
        initial_agent_balance - final_agent_balance == prompt_price, 'Agent balance should decrease'
    );
}

#[test]
fn test_reclaim_prompt_exact_delay() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    let (agent_address, prompt_id) = setup_agent_with_prompt(registry, token, creator, prompt_price);
    let agent = IAgentDispatcher { contract_address: agent_address };

    let current_time = get_block_timestamp();
    start_warp(current_time + RECLAIM_DELAY);

    start_cheat_caller_address(agent.contract_address, creator);
    agent.reclaim_prompt(prompt_id);
    stop_cheat_caller_address(agent.contract_address);

    stop_warp();
}
