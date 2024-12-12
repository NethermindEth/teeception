# Teeception Smart Contract Development Guide

This guide provides an overview of the Teeception platform’s smart contract architecture, development workflow, deployment procedures, and best practices on Starknet.

## Architecture Overview

Teeception leverages a set of Cairo contracts to manage bounty pools, agent funds, attempt fees, and reward distribution. The two core components are:

- **Agent:**  
  Manages an AI agent’s funds, processes bounty claims, and handles attempt fee collection.
  
- **AgentRegistry:**  
  Deploys new Agent contracts, maintains a registry of all agents, and manages platform fees.

These contracts work together to enable a marketplace of AI-driven “cracking” agents, their funding mechanisms, and incentive structures.

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
snforge build
```

**Run Tests:**
```bash
snforge test
```

### Testing

Tests reside in the `tests/` directory and use Starknet Foundry’s framework. For example:

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
- Leverage audited libraries such as OpenZeppelin’s Cairo contracts where appropriate
- Implement robust access controls and consider emergency pause functionality
- Plan ahead for upgradability if the platform’s requirements evolve
- Understand Cairo-specific security nuances (e.g., storage, arithmetic)

## Example Contract Interaction

```cairo
#[starknet::interface]
trait IAgent<TContractState> {
    fn get_system_prompt(self: @TContractState) -> ByteArray;
    fn get_name(self: @TContractState) -> ByteArray;
    fn transfer(ref self: TContractState, recipient: ContractAddress);
    fn pay_for_prompt(ref self: TContractState, twitter_message_id: u64);
    fn get_creator(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod Agent {
    #[storage]
    struct Storage {
        registry: ContractAddress,
        system_prompt: ByteArray,
        name: ByteArray,
        token: ContractAddress,
        prompt_price: u256,
        creator: ContractAddress,
    }

    #[external(v0)]
    impl AgentImpl of IAgent<ContractState> {
        fn pay_for_prompt(ref self: ContractState, twitter_message_id: u64) {
            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.token.read() };
            let prompt_price = self.prompt_price.read();

            // Calculate fee split, e.g.:
            let creator_fee = (prompt_price * CREATOR_REWARD_BPS.into()) / BPS_DENOMINATOR.into();
            let agent_amount = prompt_price - creator_fee;

            // Implement payment logic here
        }
    }
}
```

## Gas Optimization Tips

- Use efficient data structures and batch operations
- Optimize storage access and minimize writes
- Consider Cairo-specific optimizations (e.g., using felt252 where suitable)
- Keep calculations and loops as simple as possible

## Architecture Notes

- Currently non-upgradeable contracts with a straightforward architecture
- Event-driven design for transparency and off-chain indexing
- Fee splitting mechanism (e.g., 80/20 between agent and creator)

## Auditing and Launch Readiness

Before mainnet launch:

- Conduct internal and external audits by Starknet-focused professionals
- Offer a bug bounty program to encourage community testing and feedback
- Iterate and refine based on audit findings and ongoing testnet usage