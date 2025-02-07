# Contributing to Teeception

Thank you for your interest in contributing to Teeception! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Style](#code-style)
- [Documentation](#documentation)

## Development Setup

### Prerequisites

- Node.js and npm (for extension development)
- Scarb (Cairo package manager)
- jq (JSON processor for scripts)
- Go 1.20 or later (for TEE development)
- Docker and Docker Compose (for local development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/NethermindEth/teeception.git
cd teeception
```

2. Install root dependencies:
```bash
npm install
```

3. Install jq:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

4. Set up the Git pre-commit hook:
```bash
mkdir -p .git/hooks
cp scripts/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

### Running Components Locally

#### Running an Agent
```bash
go run cmd/agent/main.go
```

#### Smart Contract Development
```bash
cd contracts
snforge build
snforge test
```

#### Chrome Extension Development
```bash
cd extension
npm install
npm run dev:watch
```

#### Frontend Development
```bash
cd frontend
npm install
npm run de
```


### Key Components

- **TEE Agent**: Runs in a Trusted Execution Environment, handles prompt evaluation and asset management
- **Smart Contracts**: Manage agent registration, challenge attempts, and reward distribution
- **Chrome Extension**: User interface for interacting with agents and managing challenges
- **Frontend**: Status website and leaderboards

## Development Workflow

1. **Fork and Clone**: Fork the repository and clone it locally
2. **Branch**: Create a branch for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Develop**: Make your changes, following our code style guidelines
4. **Test**: Run relevant tests and add new ones if needed
5. **Commit**: Use clear commit messages
6. **Push and PR**: Push your changes and create a pull request

### ABI Synchronization

The project maintains automatic synchronization between Cairo contract ABIs and TypeScript interfaces. This is handled by the pre-commit hook:

1. Builds contracts using Scarb
2. Extracts ABIs from contract class files
3. Updates TypeScript ABI files in `extension/src/abis/`
4. Verifies all changes are committed

To manually sync ABIs:
```bash
./scripts/sync-abis.sh
```

## Testing Guidelines

- **Smart Contracts**: Write comprehensive tests for all contract functionality
- **TEE Agent**: Test prompt evaluation and security boundaries
- **Extension**: Test UI components and contract interactions
- **Integration**: Test full user flows across components

## Code Style

- **Cairo**: Follow the Cairo style guide
- **TypeScript**: Use ESLint and Prettier configurations
- **Go**: Follow Go style conventions and use gofmt
- **Documentation**: Keep inline documentation up to date

## Documentation

- Update relevant documentation when making changes
- Document new features and APIs
- Keep the README and website content current
- Add inline comments for complex logic

## Getting Help

- Join our [telegram](https://t.me/nm_teeception)
- Check existing issues and discussions
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License. 