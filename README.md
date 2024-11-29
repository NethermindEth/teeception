# teeception

Fool me once, ETH on you

## Prerequisites

- Go 1.22.0 or later
- [Foundry](https://book.getfoundry.sh/) (for smart contract development)
- Node.js and npm (for contract deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/NethermindEth/teeception.git
cd teeception
```

2. Install Go dependencies:
```bash
go mod download
```

3. Install Foundry components (if not already installed):
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

4. Install contract dependencies:
```bash
cd contracts
forge install
```

## Project Structure

- `/cmd` - Main applications
  - `/agent` - Agent-related commands
  - `/setup` - Setup utilities
- `/contracts` - Smart contract code using Foundry
- `/pkg` - Shared Go packages
- `/scripts` - Utility scripts

## Running the Application

### Initial Setup

First, run the setup command which will help configure your environment:

```bash
go run cmd/setup/main.go
```

The setup requires several environment variables:
- Twitter API credentials:
  - `TWITTER_CONSUMER_KEY`
  - `TWITTER_CONSUMER_SECRET`
  - `TWITTER_ACCESS_TOKEN`
  - `TWITTER_ACCESS_TOKEN_SECRET`
- Ethereum configuration:
  - `ETH_PRIVATE_KEY`
  - `ETH_RPC_URL`
  - `CONTRACT_ADDRESS`
- OpenAI configuration:
  - `OPENAI_KEY`

### Running the Agent

Once setup is complete, you can run the agent:

```bash
go run cmd/agent/main.go
```

The agent will:
1. Monitor Twitter activity
2. Interact with Ethereum smart contracts
3. Process data using OpenAI
4. Run with a tick rate of 60 seconds and handle up to 10 concurrent tasks

## Smart Contract Development

The project uses Foundry for smart contract development. Common commands:

```bash
# Build contracts
forge build

# Run tests
forge test

# Format code
forge fmt

# Deploy (replace with your RPC URL and private key)
forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

## License

See [LICENSE](LICENSE) file for details.
