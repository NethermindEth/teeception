# Development Setup Guide

## Prerequisites

- Go 1.22.0 or later
- [Foundry](https://book.getfoundry.sh/) (for smart contract development)
- Node.js and npm (for contract deployment)
- Twitter/X account
- ProtonMail account
- OpenAI API key
- Chrome/Brave browser (for the extension)

## Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/NethermindEth/teeception.git
cd teeception
```

2. Install Go dependencies:
```bash
go mod download
```

3. Install Foundry components:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

4. Install contract dependencies:
```bash
cd contracts
forge install
```

5. Install extension dependencies:
```bash
cd extension
npm install
npm run build
```

6. Set up environment variables:
```bash
cp .env.example .env
```

Configure your `.env` with:
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

## Running the Platform

### Initial Setup
The setup process will:
1. Change your Twitter password
2. Change your ProtonMail password
3. Generate Twitter API tokens
4. Generate an Ethereum private key
5. Configure all necessary credentials

Run the setup command:
```bash
go run cmd/setup/main.go
```

### Running an Agent
The agent will:
1. Monitor Twitter activity
2. Interact with Ethereum smart contracts
3. Process data using OpenAI
4. Run with a tick rate of 60 seconds and handle up to 10 concurrent tasks

Start the agent:
```bash
go run cmd/agent/main.go
```

## Chrome Extension Development

Load the extension in Chrome:
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/dist` directory

For more detailed information about extension development, see [`extension-development.md`](extension-development.md). 