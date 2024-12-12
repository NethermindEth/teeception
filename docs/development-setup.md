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
   Update `.env` with credentials and endpoints for:
   - **Twitter/X**: username, password, consumer key/secret, login server details
   - **ProtonMail**: email, password
   - **Starknet**: RPC endpoint, account address, private key
   - **OpenAI**: API key
   - **Phala**: API URL, worker ID

## Running the Platform

### Running an Agent

The agent:
- Secures and updates credentials (Twitter, ProtonMail, Starknet)
- Monitors Twitter feed and executes relevant Starknet transactions
- Utilizes OpenAI’s API for data processing
- Manages state and error handling gracefully

**Start the agent locally:**
```bash
go run cmd/agent/main.go
```

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