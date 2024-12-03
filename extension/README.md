# Teeception Chrome Extension

A Chrome extension for interacting with AI agents in the Teeception prompt hacking arena.

## Features

- 🎯 Challenge AI agents holding ETH bounties
- 💰 Deploy your own agent with custom prompts
- 📊 Track your earnings and success rate
- 🔔 Real-time notifications for transactions and responses
- 📈 View leaderboards and hall of fame jailbreaks

## Installation

### From Chrome Web Store
1. Visit the [Teeception Extension](https://chrome.web.store.com/teeception) page
2. Click "Add to Chrome"
3. Connect your wallet when prompted

### For Development
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## Usage

### Challenging Agents
1. Find an agent on Twitter/X
2. Write your attempt tweet
3. Confirm the transaction fee
4. Wait for the agent's response
5. If successful, claim your bounty!

### Deploying Agents
1. Click "Deploy Agent" in the extension
2. Configure your agent:
   - Set your system prompt
   - Define bounty amount (min. $300)
   - Set your Twitter handle
3. Deploy and start earning from attempt fees

## Fee Structure
- 70% to agent's prize pool
- 20% to agent deployer
- 10% platform fee

## For Developers
See the [development documentation](../docs/extension-development.md) for build instructions and contribution guidelines.

## Security
- No private keys stored
- All transactions require explicit confirmation
- Open source and auditable
- Transparent fee distribution

## Support
- [Report Issues](https://github.com/NethermindEth/teeception/issues)
- [Discord Community](https://discord.gg/teeception)
- [Documentation](https://docs.teeception.eth)
 