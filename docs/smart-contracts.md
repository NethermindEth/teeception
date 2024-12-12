# Teeception Smart Contract Development Guide

This guide provides an overview of the Teeception platform's smart contract architecture, development workflow, deployment procedures, and best practices on Starknet.

## Architecture Overview

Teeception leverages a set of Cairo contracts to manage bounty pools, agent funds, attempt fees, and reward distribution. The two core components are:

- **Agent:**  
  Manages an AI agent's funds, processes bounty claims, handles attempt fee collection, and implements time-based access controls.
  
- **AgentRegistry:**  
  Deploys new Agent contracts, maintains a registry of all agents, manages platform fees, and controls agent transfers.

These contracts work together to enable a marketplace of AI-driven "crackable" agents.

## Development Environment

### Prerequisites

- **Starknet Foundry** for building and testing
- **Scarb** for managing and deploying Cairo projects
- A local Starknet node (e.g., `starknet-devnet`) for testing

### Setup Commands

**Install Starknet Foundry:**
```bash
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
snfoundryup
```

**Build Contracts:**
```bash
scarb build
```

**Run Tests:**
```bash
snforge test
```

### Testing

Tests reside in the `tests/` directory and use Starknet Foundry's framework. For example:

```cairo
#[test]
fn test_bounty_claim() {
    // Example test implementation
}
```

## Deployment

### Local Deployment

1. Start a local Starknet node:
   ```bash
   starknet-devnet
   ```
   
2. Deploy contracts locally:
   ```bash
   scarb run deploy-local
   ```

### Testnet Deployment

1. Set required environment variables:
   ```bash
   export STARKNET_ACCOUNT=your_account_address
   export STARKNET_PRIVATE_KEY=your_private_key
   export STARKNET_RPC=your_rpc_url
   ```
   
2. Deploy to testnet:
   ```bash
   scarb run deploy-testnet
   ```

## Security Considerations

- Thorough testing of all contract logic
- Leverage audited libraries such as OpenZeppelin's Cairo contracts where appropriate
- Implement robust access controls and consider emergency pause functionality
- Plan ahead for upgradability if the platform's requirements evolve
- Understand Cairo-specific security nuances (e.g., storage, arithmetic)

## Contract Interfaces and Implementation

### Agent Registry Interface

```cairo
#[starknet::interface]
pub trait IAgentRegistry<TContractState> {
    fn register_agent(
        ref self: TContractState,
        name: ByteArray,
        system_prompt: ByteArray,
        prompt_price: u256,
        end_time: u64,
    ) -> ContractAddress;
    fn get_token(self: @TContractState) -> ContractAddress;
    fn is_agent_registered(self: @TContractState, address: ContractAddress) -> bool;
    fn get_agents(self: @TContractState) -> Array<ContractAddress>;
    fn get_registration_price(self: @TContractState) -> u256;
    fn transfer(ref self: TContractState, agent: ContractAddress, recipient: ContractAddress);
}
```

### Agent Interface

```cairo
#[starknet::interface]
pub trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn get_end_time(self: @TContractState) -> u64;
    fn get_creator(self: @TContractState) -> ContractAddress;
    fn get_prompt_price(self: @TContractState) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress);
    fn pay_for_prompt(ref self: TContractState, twitter_message_id: u64);
}
```

### Key Implementation Details

1. **Fee Structure**
   ```cairo
   const PROMPT_REWARD_BPS: u16 = 8000; // 80% goes to agent
   const CREATOR_REWARD_BPS: u16 = 2000; // 20% goes to prompt creator
   const BPS_DENOMINATOR: u16 = 10000;
   ```

2. **Time-Based Access Control**
   The Agent contract implements time-based restrictions on transfers:
   - Before `end_time`: Only the registry can transfer the agent
   - After `end_time`: Only the creator can transfer the agent

3. **Events**
   ```cairo
   #[event]
   pub struct PromptPaid {
       #[key]
       pub user: ContractAddress,
       #[key]
       pub twitter_message_id: u64,
       pub amount: u256,
       pub creator_fee: u256,
   }
   ```

## Gas Optimization Tips

- Use efficient data structures and batch operations
- Optimize storage access and minimize writes
- Consider Cairo-specific optimizations (e.g., using felt252 where suitable)
- Keep calculations and loops as simple as possible

## Architecture Notes

- Non-upgradeable contracts with a straightforward architecture
- Event-driven design for transparency and off-chain indexing
- 80/20 fee splitting between agent and creator
- Time-based access controls for agent transfers
- Registry-based deployment and management system

## Auditing and Launch Readiness

Before mainnet launch:

- Conduct internal and external audits by Starknet-focused professionals
- Offer a bug bounty program to encourage community testing and feedback
- Iterate and refine based on audit findings and ongoing testnet usage