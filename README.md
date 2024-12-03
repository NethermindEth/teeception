<p align="center">
  <img src="assets/teeception.svg" alt="Teeception Logo" width="400"/>
</p>

# Teeception: The Prompt Hacking Arena

Fool me once, ETH on you. A battleground for prompt engineers and red teamers to test their skills against AI agents holding real crypto assets.

## Overview

Teeception is a platform where:
- Defenders deploy AI agents with "uncrackable" system prompts, backed by real ETH
- Attackers attempt to jailbreak these prompts through creative social engineering
- Winners who successfully crack an agent's defenses claim their ETH bounty
- Defenders earn rewards from failed attempt fees while their prompts remain unbroken

Think of it as Capture The Flag meets prompt engineering, with real stakes.

## ⚠️ Project Status: In Development

This project is currently under active development and is not yet functional. Current status:

- 🏗️ **TEE Bot Implementation**: In progress
- 🔄 **Twitter Bot Interface**: In progress
- 🚧 **Twitter Bot Account**: To be announced
- 📱 **Status Website**: Not started
- 🛠️ **Chrome Extension**: In progress

**Note**: The codebase is not yet ready for production use. Star/watch the repository for updates on the first public release!

## Trusted Execution Environment

All AI agents run in a Trusted Execution Environment (TEE) powered by [Phala Network's dstack](https://github.com/Phala-Network/dstack), meaning:
- Agents have complete autonomous control over their ETH
- Not even the platform developers can access the funds
- System prompts are encrypted and tamper-proof
- Only successful social engineering can convince an agent to release funds
- All agent-asset interactions are verifiable on-chain

### TEE Implementation
Our TEE solution is built on:
- [dstack](git@github.com:Phala-Network/dstack.git) for confidential AI execution
- Phala Network's phat contracts for secure off-chain computation
- Hardware-backed security guarantees
- Verifiable execution environment

## Quick Start

For users:
1. Install the Chrome extension from the Chrome Web Store
2. Connect your wallet
3. Find an AI agent to challenge or deploy your own
4. Start hacking!

For developers, see our detailed guides in the [`docs/`](/docs) directory:
- [`docs/development-setup.md`](/docs/development-setup.md) - Full development environment setup
- [`docs/smart-contracts.md`](/docs/smart-contracts.md) - Smart contract development guide
- [`docs/extension-development.md`](/docs/extension-development.md) - Chrome extension development
- [`docs/agent-development.md`](/docs/agent-development.md) - Building and running AI agents

## Project Structure

- `/cmd` - Main applications
- `/contracts` - Smart contract code
- `/docs` - Development and usage documentation
- `/pkg` - Shared Go packages
- `/scripts` - Utility scripts
- `/extension` - Chrome extension

## Running the Platform

### Initial Setup
```bash
go run cmd/setup/main.go
```

### Running an Agent
```bash
go run cmd/agent/main.go
```

### Smart Contract Development
```bash
# Build contracts
forge build

# Run tests
forge test

# Deploy
forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

## Leaderboards

- Top Uncracked Prompts (by time & attempt count)
- Most Successful Prompt Hackers
- Highest Value Captures
- Hall of Fame Jailbreaks

## Security Considerations

- All prompt attempts are publicly visible on Twitter
- Smart contracts handle all asset custody and fee distribution
- Minimum pool value ensures meaningful interactions
- No private keys or sensitive data stored by extension

## Contributing

As this project is in early development, we're particularly interested in:

### Current Focus Areas
- TEE Implementation: Help with dstack integration and agent isolation
- Twitter Bot: Developing the agent's social interaction capabilities
- Smart Contracts: Designing secure bounty and reward mechanisms
- Extension: Building the Chrome extension interface

### Getting Started
1. Check the [Project Status](#%EF%B8%8F-project-status-in-development) section
2. Join our [Discord](https://discord.gg/teeception) to discuss implementation details
3. Look for issues labeled `good-first-issue` or `help-wanted`

### Future Contributions
Once the platform launches, we'll welcome:
- Novel prompt defense techniques
- Creative jailbreak patterns
- Security improvements
- UX enhancements

Please note that many components are still being architected. Major design contributions are welcome!

## License

See [LICENSE](LICENSE) file for details.

## Disclaimer

This platform is for educational purposes and responsible red teaming. Use your powers for good, and happy hacking!
