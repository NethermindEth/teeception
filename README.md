# teeception

Fool me once, ETH on you

## Prerequisites

- Go 1.22.0 or later
- [Foundry](https://book.getfoundry.sh/) (for smart contract development)
- Node.js and npm (for contract deployment)
- Twitter/X account
- ProtonMail account
- OpenAI API key

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
Then edit `.env` with your actual credentials and configuration values:

- Twitter/X Credentials:
  - `X_USERNAME`: Your Twitter/X account username
  - `X_PASSWORD`: Your Twitter/X account password
  - `X_CONSUMER_KEY`: Twitter API consumer key (from Developer Portal)
  - `X_CONSUMER_SECRET`: Twitter API consumer secret (from Developer Portal)
- ProtonMail Credentials:
  - `PROTONMAIL_EMAIL`: Your ProtonMail email address
  - `PROTONMAIL_PASSWORD`: Your ProtonMail password
- Ethereum Configuration:
  - `ETH_RPC_URL`: Your Ethereum RPC endpoint
  - `CONTRACT_ADDRESS`: The deployed contract address
- OpenAI Configuration:
  - `OPENAI_API_KEY`: Your OpenAI API key

## Project Structure

- `/cmd` - Main applications
  - `/agent` - Agent-related commands
  - `/setup` - Setup utilities
- `/contracts` - Smart contract code using Foundry
- `/pkg` - Shared Go packages
- `/scripts` - Utility scripts

## Running the Application

### Initial Setup

First, ensure your `.env` file is configured with all required values. The setup process will:
1. Change your Twitter password
2. Change your ProtonMail password
3. Generate Twitter API tokens
4. Generate an Ethereum private key
5. Configure all necessary credentials

Run the setup command:
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
