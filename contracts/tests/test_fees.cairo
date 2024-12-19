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

// Constants for fee calculations
const CREATOR_REWARD_BPS: u16 = 2000; // 20%
const PROTOCOL_FEE_BPS: u16 = 1000; // 10%
const BPS_DENOMINATOR: u16 = 10000; // 100%

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

fn setup_agent_with_prompt(
    registry: IAgentRegistryDispatcher, token: ContractAddress, creator: ContractAddress, prompt_price: u256
) -> (ContractAddress, u64) {
    // Register agent
    start_cheat_caller_address(registry.contract_address, creator);
    let agent_address = registry.register_agent("Test Agent", "Test Prompt", prompt_price);
    stop_cheat_caller_address(registry.contract_address);

    let agent = IAgentDispatcher { contract_address: agent_address };

    // Approve token spending
    start_cheat_caller_address(token, creator);
    let token_dispatcher = IERC20Dispatcher { contract_address: token };
    token_dispatcher.approve(agent_address, prompt_price);
    stop_cheat_caller_address(token);

    // Pay for prompt
    start_cheat_caller_address(agent.contract_address, creator);
    let prompt_id = agent.pay_for_prompt(12345);
    stop_cheat_caller_address(agent.contract_address);

    (agent_address, prompt_id)
}

#[test]
fn test_fee_distribution() {
    // Setup
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 100;
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    // Setup agent and pay for prompt
    let (agent_address, prompt_id) = setup_agent_with_prompt(registry, token, creator, prompt_price);
    let agent = IAgentDispatcher { contract_address: agent_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Get initial balances
    let initial_creator_balance = token_dispatcher.balance_of(creator);
    let initial_registry_balance = token_dispatcher.balance_of(registry_address);
    let initial_agent_balance = token_dispatcher.balance_of(agent_address);

    // Consume prompt to trigger fee distribution
    start_cheat_caller_address(registry.contract_address, tee);
    agent.consume_prompt(prompt_id);
    stop_cheat_caller_address(registry.contract_address);

    // Calculate expected fees
    let creator_fee = (prompt_price * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
    let protocol_fee = (prompt_price * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
    let agent_amount = prompt_price - creator_fee - protocol_fee;

    // Verify fee distribution
    let final_creator_balance = token_dispatcher.balance_of(creator);
    let final_registry_balance = token_dispatcher.balance_of(registry_address);
    let final_agent_balance = token_dispatcher.balance_of(agent_address);

    assert(
        final_creator_balance - initial_creator_balance == creator_fee, 'Wrong creator fee distribution'
    );
    assert(
        final_registry_balance - initial_registry_balance == protocol_fee,
        'Wrong protocol fee distribution'
    );
    assert(final_agent_balance - initial_agent_balance == agent_amount, 'Wrong agent amount');
}

#[test]
fn test_fee_rounding() {
    // Setup with an amount that doesn't divide evenly
    let tee = starknet::contract_address_const::<0x1>();
    let creator = starknet::contract_address_const::<0x123>();
    let prompt_price: u256 = 101; // Odd number to test rounding
    let (registry_address, token) = deploy_registry(tee, creator);
    let registry = IAgentRegistryDispatcher { contract_address: registry_address };

    // Setup agent and pay for prompt
    let (agent_address, prompt_id) = setup_agent_with_prompt(registry, token, creator, prompt_price);
    let agent = IAgentDispatcher { contract_address: agent_address };
    let token_dispatcher = IERC20Dispatcher { contract_address: token };

    // Get initial balances
    let initial_creator_balance = token_dispatcher.balance_of(creator);
    let initial_registry_balance = token_dispatcher.balance_of(registry_address);
    let initial_agent_balance = token_dispatcher.balance_of(agent_address);

    // Consume prompt to trigger fee distribution
    start_cheat_caller_address(registry.contract_address, tee);
    agent.consume_prompt(prompt_id);
    stop_cheat_caller_address(registry.contract_address);

    // Calculate expected fees with rounding
    let creator_fee = (prompt_price * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
    let protocol_fee = (prompt_price * PROTOCOL_FEE_BPS.into()) / BPS_DENOMINATOR.into();
    let agent_amount = prompt_price - creator_fee - protocol_fee;

    // Verify fee distribution with rounding
    let final_creator_balance = token_dispatcher.balance_of(creator);
    let final_registry_balance = token_dispatcher.balance_of(registry_address);
    let final_agent_balance = token_dispatcher.balance_of(agent_address);

    // Verify exact amounts including rounding
    assert(
        final_creator_balance - initial_creator_balance == creator_fee, 'Wrong creator fee with rounding'
    );
    assert(
        final_registry_balance - initial_registry_balance == protocol_fee,
        'Wrong protocol fee with rounding'
    );
    assert(
        final_agent_balance - initial_agent_balance == agent_amount, 'Wrong agent amount with rounding'
    );

    // Verify total distribution equals original amount
    assert(
        creator_fee + protocol_fee + agent_amount == prompt_price,
        'Total distribution should equal prompt price'
    );
}
