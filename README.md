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

5. Set up environment variables:
```bash
cp .env.example .env
```
Then edit `.env` with your actual credentials and configuration values.

## Project Structure

- `/cmd` - Main applications
  - `/agent` - Agent-related commands
  - `/setup` - Setup utilities
- `/contracts` - Smart contract code using Foundry
- `/pkg` - Shared Go packages
- `/scripts` - Utility scripts

## Running the Application

### Initial Setup

First, ensure your `.env` file is configured with the required values:
- Twitter API credentials (obtain from [Twitter Developer Portal](https://developer.twitter.com/))
- Ethereum configuration (your private key and RPC URL)
- OpenAI API key (obtain from [OpenAI](https://platform.openai.com/))

Then run the setup command:

```bash
go run cmd/setup/main.go
```

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
