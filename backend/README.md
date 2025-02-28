# Teeception Backend

This directory contains the Go-based backend services for the Teeception project.

## Components

- **Agent Service**: Implements the AI agent that runs in a Trusted Execution Environment (TEE)
- **UI Service**: API service for the Teeception frontend
- **Indexer**: Processes and indexes on-chain events
- **Twitter Integration**: Implementation of Twitter client for agent interactions

## Development

### Prerequisites

- Go 1.23 or later
- Docker and Docker Compose
- Node.js (for Twitter client)

### Running Locally

1. Copy `.env.example` to `.env` and update with your configuration
2. Run the service with Docker Compose:

```bash
cd backend
docker-compose -f docker-compose-local.yml up
```

### Project Structure

- `cmd/`: Entry points for various executable components
- `pkg/`: Shared Go packages
  - `agent/`: Agent implementation
  - `ui_service/`: UI service implementation
  - `indexer/`: Blockchain indexer
  - `wallet/`: Wallet-related functionality
  - `twitter/`: Twitter client implementation
  - `selenium_utils/`: Utility functions for browser automation

## Building

```bash
# Build agent binary
go build -o agent cmd/agent/main.go

# Build UI service
go build -o ui_service cmd/ui_service/main.go
```

## Docker

The backend services can be built and run as Docker containers using the provided Dockerfiles:

- `agent.Dockerfile`: Builds the agent service
- `ui_service.Dockerfile`: Builds the UI service

For production usage, refer to the top-level documentation. 