# Smart Contract Development Guide

This guide covers the development and deployment of smart contracts for the Teeception platform.

## Contract Architecture

The Teeception platform uses several smart contracts to manage:
- Bounty pools
- Agent funds
- Attempt fees
- Reward distribution

### Core Contracts

1. **TeeceptionAgent**
   - Manages individual AI agent funds
   - Handles bounty claims
   - Controls attempt fee collection

2. **TeeceptionFactory**
   - Deploys new agent contracts
   - Manages agent registry
   - Handles platform fees

## Development Environment

### Setup

1. Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Build contracts:

```bash
forge build
```

3. Run tests:

```bash
forge test
```

### Testing

We use Foundry's testing framework. Create tests in the `test/` directory:

```solidity
// test/TeeceptionAgent.t.sol
pragma solidity ^0.8.13;
import "forge-std/Test.sol";
import "../src/TeeceptionAgent.sol";

contract TeeceptionAgentTest is Test {
    TeeceptionAgent agent;

    function setUp() public {
        agent = new TeeceptionAgent();
    }

    function testBountyClaim() public {
        // Test implementation
    }
}
```

## Deployment

### Local Development

1. Start local node:

```bash
anvil
```

2. Deploy contracts:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url http://localhost:8545 --broadcast
```

### Testnet Deployment

1. Set environment variables:

```bash
export PRIVATE_KEY=your_private_key
export RPC_URL=your_rpc_url
```

2. Deploy to testnet:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

## Security Considerations

- All contracts should be thoroughly tested
- Consider using OpenZeppelin contracts for standard functionality
- Implement proper access controls
- Add emergency pause functionality
- Plan for upgradability where appropriate

## Contract Interaction

Example interaction with deployed contracts:

```solidity
// Create new agent
function createAgent(string memory prompt) external payable {
    require(msg.value >= minimumBounty, "Insufficient bounty");
    // Implementation
}

// Attempt to crack prompt
function attemptCrack(uint256 agentId, string memory attempt) external payable {
    require(msg.value >= attemptFee, "Insufficient fee");
    // Implementation
}
```

## Gas Optimization

- Use appropriate data structures
- Batch operations where possible
- Optimize storage usage
- Consider using assembly for complex operations

## Upgradeability

The platform uses the OpenZeppelin upgradeable contracts pattern:

1. Proxy contracts
2. Implementation contracts
3. ProxyAdmin contract

## Auditing

Before mainnet deployment:
1. Internal audit
2. External audit
3. Bug bounty program

## Future Improvements

- Implement governance mechanisms
- Add more complex reward structures
- Develop additional agent types 