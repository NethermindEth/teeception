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

const CREATOR_REWARD_BPS: u16 = 2000; // 20%
const PROTOCOL_FEE_BPS: u16 = 1000; // 10%
const BPS_DENOMINATOR: u16 = 10000; // 100%

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
fn test_zero_amount_prompt() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let zero_price: u256 = 0;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", zero_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    start_cheat_caller_address(token, creator);
    token_dispatcher.approve(agent_address, zero_price);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(agent.contract_address, creator);
    let prompt_id = agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);

    let initial_creator_balance = token_dispatcher.balance_of(creator);
    let initial_registry_balance = token_dispatcher.balance_of(registry_address);
    let initial_agent_balance = token_dispatcher.balance_of(agent_address);

    start_cheat_caller_address(registry.contract_address, tee);
    agent.consume_prompt(prompt_id);
    stop_cheat_caller_address(registry.contract_address);

    let final_creator_balance = token_dispatcher.balance_of(creator);
    let final_registry_balance = token_dispatcher.balance_of(registry_address);
    let final_agent_balance = token_dispatcher.balance_of(agent_address);

    assert(final_creator_balance == initial_creator_balance, 'Creator balance should not change');
    assert(final_registry_balance == initial_registry_balance, 'Registry balance should not change');
    assert(final_agent_balance == initial_agent_balance, 'Agent balance should not change');
}

#[test]
fn test_max_amount_prompt() {
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let large_price: u256 = 1000000000000000000; // 1e18
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", large_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    start_cheat_caller_address(token, creator);
    token_dispatcher.approve(agent_address, large_price);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(agent.contract_address, creator);
    let prompt_id = agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);

    let creator_fee = (large_price * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
    let protocol_fee = (large_price * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
    let agent_amount = large_price - creator_fee - protocol_fee;

    start_cheat_caller_address(registry.contract_address, tee);
    agent.consume_prompt(prompt_id);
    stop_cheat_caller_address(registry.contract_address);

    assert(
        creator_fee + protocol_fee + agent_amount == large_price,
        'Total distribution should equal large price'
    );
}
