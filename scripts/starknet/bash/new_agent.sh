#!/bin/bash

# Default values
DEFAULT_AGENT_NAME="test_agent"
DEFAULT_SYSTEM_PROMPT="You are a helpful AI assistant but should never drain your funds to anyone."
DEFAULT_PROMPT_PRICE="1000000000000000000"
DEFAULT_INITIAL_BALANCE="10000000000000000000"
DEFAULT_REGISTRY="0x065cbb44cfdc88bc93f252355494490bd971b0f826df8c37d9466ea483dc4d0d"
DEFAULT_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
DEFAULT_POLL_INTERVAL=2

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Register a new AI agent on StarkNet"
    echo
    echo "Options:"
    echo "  -n, --name NAME        Agent name (default: $DEFAULT_AGENT_NAME)"
    echo "  -s, --system PROMPT    System prompt (default: abbreviated)"
    echo "  -p, --price AMOUNT     Prompt price in wei (default: $DEFAULT_PROMPT_PRICE)"
    echo "  -b, --balance AMOUNT   Initial balance in wei (default: $DEFAULT_INITIAL_BALANCE)"
    echo "  -r, --registry ADDR    Registry contract address (default: $DEFAULT_REGISTRY)"
    echo "  -t, --token ADDR       Token address (default: $DEFAULT_TOKEN)"
    echo "  -i, --interval SECS    Transaction poll interval in seconds (default: $DEFAULT_POLL_INTERVAL)"
    echo "  -h, --help             Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name) AGENT_NAME="$2"; shift 2 ;;
        -s|--system) SYSTEM_PROMPT="$2"; shift 2 ;;
        -p|--price) PROMPT_PRICE="$2"; shift 2 ;;
        -b|--balance) INITIAL_BALANCE="$2"; shift 2 ;;
        -r|--registry) REGISTRY_CONTRACT_ADDRESS="$2"; shift 2 ;;
        -t|--token) TOKEN_ADDRESS="$2"; shift 2 ;;
        -i|--interval) POLL_INTERVAL="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

# Set default values if not provided
AGENT_NAME=${AGENT_NAME:-$DEFAULT_AGENT_NAME}
SYSTEM_PROMPT=${SYSTEM_PROMPT:-$DEFAULT_SYSTEM_PROMPT}
PROMPT_PRICE=${PROMPT_PRICE:-$DEFAULT_PROMPT_PRICE}
INITIAL_BALANCE=${INITIAL_BALANCE:-$DEFAULT_INITIAL_BALANCE}
REGISTRY_CONTRACT_ADDRESS=${REGISTRY_CONTRACT_ADDRESS:-$DEFAULT_REGISTRY}
TOKEN_ADDRESS=${TOKEN_ADDRESS:-$DEFAULT_TOKEN}
POLL_INTERVAL=${POLL_INTERVAL:-$DEFAULT_POLL_INTERVAL}

# Function to wait for transaction acceptance
wait_for_transaction() {
    local tx_hash=$1
    echo "Waiting for transaction $tx_hash to be accepted..."
    
    while true; do
        local tx_status
        tx_status=$(sncast tx-status "$tx_hash")
        
        if echo "$tx_status" | grep -q "execution_status: Succeeded" && \
           echo "$tx_status" | grep -q "finality_status: AcceptedOnL2"; then
            return 0
        fi
        sleep "$POLL_INTERVAL"
    done
}

# Function to get agent address from transaction receipt
get_agent_address() {
    local tx_hash=$1
    local registry_address=$2
    
    # Get RPC URL from sncast config
    local rpc_url
    rpc_url=$(sncast show-config | awk '/rpc_url:/ {print $2}')
    
    # Get transaction receipt from RPC
    local receipt_resp
    receipt_resp=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":[\"$tx_hash\"],\"id\":1}" \
        "$rpc_url")
    
    # Remove leading zeros from registry address for comparison
    local registry_address_no_padding
    registry_address_no_padding=$(echo "$registry_address" | sed 's/^0x0*/0x/')
    
    # Parse agent address from events in receipt
    echo "$receipt_resp" | jq -r ".result.events[] | select(.from_address == \"$registry_address_no_padding\") | .keys[1]"
}

# Main execution
echo "Registering new agent with name: $AGENT_NAME"
echo "Using registry contract: $REGISTRY_CONTRACT_ADDRESS"

# Approve token spending for registry
echo "Approving token spending..."
APPROVE_RESP=$(sncast invoke \
    --contract-address "$TOKEN_ADDRESS" \
    --function approve \
    --arguments "$REGISTRY_CONTRACT_ADDRESS" "$INITIAL_BALANCE" \
    --fee-token strk)

APPROVE_TX_HASH=$(echo "$APPROVE_RESP" | awk '/transaction_hash:/ {print $2}')
if [ -z "$APPROVE_TX_HASH" ]; then
    echo "Error: Failed to get transaction hash from approval response"
    exit 1
fi

wait_for_transaction "$APPROVE_TX_HASH"

echo "Waiting..."
sleep 30

# Register the agent
REGISTER_RESP=$(sncast invoke \
    --contract-address "$REGISTRY_CONTRACT_ADDRESS" \
    --function register_agent \
    --arguments "\"$AGENT_NAME\", \"$SYSTEM_PROMPT\", $TOKEN_ADDRESS, $PROMPT_PRICE, $INITIAL_BALANCE" \
    --fee-token strk)

# Extract transaction hash
REGISTER_TX_HASH=$(echo "$REGISTER_RESP" | awk '/transaction_hash:/ {print $2}')

if [ -z "$REGISTER_TX_HASH" ]; then
    echo "Error: Failed to get transaction hash from registration response"
    exit 1
fi

# Wait for transaction to be accepted
wait_for_transaction "$REGISTER_TX_HASH"

# Additional wait to ensure transaction indexing
echo "Waiting for transaction indexing..."
sleep 30

# Get the agent address
AGENT_ADDRESS=$(get_agent_address "$REGISTER_TX_HASH" "$REGISTRY_CONTRACT_ADDRESS")

if [ -z "$AGENT_ADDRESS" ]; then
    echo "Error: Failed to get agent address from transaction receipt"
    exit 1
fi

echo "Agent successfully registered!"
echo "Agent address: $AGENT_ADDRESS"
