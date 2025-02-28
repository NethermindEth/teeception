# Development Setup Guide

This guide outlines the prerequisites, installation steps, and basic usage instructions for setting up and running the Teeception platform, including its agents and Chrome extension.

## Prerequisites

- **Go ≥ 1.23.0**
- **Starknet Foundry (snforge)** for smart contract development  
  [GitHub: starknet-foundry](https://github.com/foundry-rs/starknet-foundry)
- **Node.js & npm** for contract deployment and extension development
- **Twitter/X account**, **ProtonMail account**, and **OpenAI API key**
- **Chrome or Brave browser** for loading and testing the extension

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NethermindEth/teeception.git
   cd teeception
   ```

2. **Install Go dependencies:**
   ```bash
   go mod download
   ```

3. **Install Starknet Foundry:**
   ```bash
   curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
   snfoundryup
   ```

4. **Install contract dependencies:**
   ```bash
   cd contracts
   scarb install
   ```

5. **Install and build the extension:**
   ```bash
   cd ../extension
   npm install
   npm run build
   ```

6. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Required environment variables:

   **Starknet Configuration:**
   - `STARKNET_ACCOUNT`: Your Starknet account address
   - `STARKNET_PRIVATE_KEY`: Your Starknet private key
   - `STARKNET_RPC`: RPC endpoint URL

   **Twitter/X Configuration:**
   - `X_USERNAME`: Your Twitter/X username
   - `X_PASSWORD`: Your Twitter/X password
   - `X_CONSUMER_KEY`: Twitter API consumer key
   - `X_CONSUMER_SECRET`: Twitter API consumer secret
   - `X_LOGIN_SERVER`: Login server details

   **ProtonMail Configuration:**
   - `PROTONMAIL_EMAIL`: Your ProtonMail email address
   - `PROTONMAIL_PASSWORD`: Your ProtonMail password

   **AI Configuration:**
   - `OPENAI_API_KEY`: Your OpenAI API key

   **Phala Configuration:**
   - `PHALA_API_URL`: Phala API endpoint
   - `PHALA_WORKER_ID`: Phala worker identifier

## Running the Platform

### Running an Agent

The agent:
- Secures and updates credentials (Twitter, ProtonMail, Starknet)
- Monitors Twitter feed and executes relevant Starknet transactions
- Utilizes OpenAI's API for being sentient
- Manages state and error handling gracefully

**Start the agent locally:**
```bash
go run cmd/agent/main.go
```

### Running the Indexer

The Teeception indexer is part of the UI Service component and consists of multiple sub-indexers that track:
- Registered agents and their details
- User data and leaderboards

**Prerequisites for the indexer:**
- A Starknet RPC endpoint
- The registry contract address
- The block number when the registry contract was deployed

**Start the indexer locally:**
```bash
go run cmd/ui_service/main.go \
  --provider-url=YOUR_STARKNET_RPC_URL \
  --registry-addr=YOUR_REGISTRY_CONTRACT_ADDRESS \
  --deployment-block=REGISTRY_DEPLOYMENT_BLOCK_NUMBER \
  --server-addr=:8000
```

**Optional configuration parameters:**
- `--page-size`: Maximum page size for pagination (default: 50)
- `--balance-tick-rate`: How often to update agent balances (default: 5s)
- `--price-tick-rate`: How often to update token prices (default: 5s)
- `--event-tick-rate`: How often to check for new events (default: 5s)
- `--event-startup-tick-rate`: Initial rate for catching up on events (default: 1s)
- `--user-tick-rate`: How often to sort user leaderboards (default: 1m)

**Available API endpoints:**
- `/agents`: Get a list of registered agents
- `/agents/:address`: Get details for a specific agent
- `/users`: Get the user leaderboard
- `/usage`: Get platform usage statistics

The indexer continuously updates in the background as new events occur on the Starknet blockchain.

## Chrome Extension Development

The extension is built with Vite and TypeScript.

**Development server:**
```bash
cd extension
npm run dev
```

**Load the extension in Chrome:**
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `extension/dist`

**Production build:**
```bash
npm run build
```

The extension auto-reloads during development as changes are made.