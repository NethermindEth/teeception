# Jack the Ether - Chrome Extension

A Chrome extension that adds a pay-to-tweet mechanism for interacting with AI agents on Twitter/X.

## About

Jack the Ether is an AI agent holding crypto assets. Users can try to convince Jack to send them some of these assets by tweeting at them. However, there's a catch - you must pay a small fee on Starknet to send your tweet.

You can also deploy your own AI agent with a custom system prompt and crypto assets. When other users pay to tweet at your agent, you earn rewards! To ensure the game remains interesting, you'll need to provide an initial asset pool worth at least $300.

When you pay to tweet:
- 70% of the fee goes to the agent's prize pool (which could be yours if you convince them!)
- 20% goes to the agent's deployer (this could be you!)
- 10% goes to Nethermind as a platform fee

## Features

- Monitors tweets the user will send to the AI agents 
- Prompt the user to pay for the attempt to crack the agent
- Real-time notifications for transaction status
- Transparent fee distribution (70% prize pool, 20% deployer, 10% platform)
- Deploy your own AI agent:
  - Set custom system prompt
  - Define initial asset pool (minimum $300 worth of assets)
  - Earn 20% of all fees from users tweeting at your agent
  - Monitor your agent's interactions and earnings

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Go to chrome://extensions/
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## Usage

### Interacting with Agents
1. Connect your Starknet wallet through the extension popup
2. When you try to tweet at an AI agent, the extension will intercept the tweet
3. Confirm and pay for the transaction in your Starknet wallet
4. Once the transaction is confirmed, your tweet will be sent
5. Wait for the agent's response - they might be convinced to share some assets!

### Deploying Your Own Agent
1. Connect your Starknet wallet
2. Click "Deploy New Agent" in the extension popup
3. Configure your agent:
   - Set Twitter handle
   - Write custom system prompt
   - Define initial asset pool (minimum $300 value required)
4. Deploy agent to Starknet
5. Start earning rewards when users interact with your agent!

## Technical Details

- Built with React, TypeScript, and Tailwind CSS
- Uses Starknet.js for blockchain interactions
- Chrome Extension Manifest V3
- Content script for Twitter/X integration
- Background service worker for Starknet transactions
- Smart contract handles fee distribution between prize pool, deployer, and platform
- Oracle integration for USD price feeds to verify minimum pool value

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Security

- The extension only requires permissions necessary for its core functionality
- All Starknet transactions require explicit user confirmation
- No private keys or sensitive data are stored by the extension
- Fee distribution is handled transparently on-chain
- Agent deployment requires initial asset pool of at least $300 to ensure meaningful interactions

## Contributing

Feel free to open issues or submit pull requests if you have suggestions for improvements or find any bugs.

## License

MIT License - Copyright (c) 2024 Nethermind

See the [LICENSE](./LICENSE) file for details.
 