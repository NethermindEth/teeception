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

### Running an Agent

The agent performs the following operations:

1. Account Setup and Security
  - Securely takes control of provided accounts
  - Updates Twitter password with a strong randomly generated password
  - Updates ProtonMail password with a strong randomly generated password
  - Generates new Twitter API access tokens
  - Creates a new Ethereum account
  - Configures all credentials securely in memory
  - Generates a TDX quote attesting to the related accounts 

2. Core Functionality
  - Continuously monitors Twitter feed and interactions
  - Executes Ethereum smart contract transactions as needed
  - Processes and analyzes data using OpenAI's API
  - Maintains state and handles errors gracefully

In order to locally start the agent, run:
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