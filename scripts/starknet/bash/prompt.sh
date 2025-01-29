#!/bin/bash

# Default values
DEFAULT_TOKEN="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
DEFAULT_POLL_INTERVAL=2
DEFAULT_INDEXING_WAIT=10

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS] --agent ADDR --tweet-id ID --prompt TEXT"
    echo "Pay for and submit a prompt to an AI agent on StarkNet"
    echo
    echo "Required:"
    echo "  -a, --agent ADDR      Agent contract address"
    echo "  -m, --tweet-id ID     Twitter message ID"
    echo "  -p, --prompt TEXT     Prompt text to send to the agent"
    echo
    echo "Optional:"
    echo "  -t, --token ADDR      Token address (default: $DEFAULT_TOKEN)"
    echo "  -i, --interval SECS   Transaction poll interval in seconds (default: $DEFAULT_POLL_INTERVAL)"
    echo "  -w, --wait SECS       Indexing wait time in seconds (default: $DEFAULT_INDEXING_WAIT)"
    echo "  -h, --help            Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--agent) AGENT_ADDRESS="$2"; shift 2 ;;
        -m|--tweet-id) TWITTER_MESSAGE_ID="$2"; shift 2 ;;
        -p|--prompt) PROMPT_TEXT="$2"; shift 2 ;;
        -t|--token) TOKEN_ADDRESS="$2"; shift 2 ;;
        -i|--interval) POLL_INTERVAL="$2"; shift 2 ;;
        -w|--wait) INDEXING_WAIT="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

# Validate required parameters
if [ -z "$AGENT_ADDRESS" ] || [ -z "$TWITTER_MESSAGE_ID" ] || [ -z "$PROMPT_TEXT" ]; then
    echo "Error: Agent address, Twitter message ID, and prompt text are required"
    show_help
    exit 1
fi

# Set default values if not provided
TOKEN_ADDRESS=${TOKEN_ADDRESS:-$DEFAULT_TOKEN}
POLL_INTERVAL=${POLL_INTERVAL:-$DEFAULT_POLL_INTERVAL}
INDEXING_WAIT=${INDEXING_WAIT:-$DEFAULT_INDEXING_WAIT}

log() {
    echo "$1" >&2
}

# Function to wait for transaction acceptance
wait_for_transaction() {
    local tx_hash=$1
    local action=$2
    log "Waiting for $action transaction $tx_hash to be accepted..."
    
    while true; do
        local tx_status
        tx_status=$(sncast tx-status "$tx_hash")
        
        if echo "$tx_status" | grep -q "execution_status: Succeeded" && \
           echo "$tx_status" | grep -q "finality_status: AcceptedOnL2"; then
            echo "$action transaction $tx_hash accepted"
            return 0
        fi
        sleep "$POLL_INTERVAL"
    done
}

# Execute token approval
log "Approving token transfer to agent..."
APPROVE_RESP=$(sncast invoke \
    --contract-address "$TOKEN_ADDRESS" \
    --function approve \
    --arguments "$AGENT_ADDRESS, 100" \
    --fee-token strk)

APPROVE_TX_HASH=$(echo "$APPROVE_RESP" | awk '/transaction_hash:/ {print $2}')

if [ -z "$APPROVE_TX_HASH" ]; then
    log "Error: Failed to get transaction hash from approval response"
    exit 1
fi

# Wait for approval transaction
wait_for_transaction "$APPROVE_TX_HASH" "approval"

# Wait for indexing
log "Waiting ${INDEXING_WAIT}s for indexing..."
sleep "$INDEXING_WAIT"

# Execute prompt payment
log "Submitting prompt payment..."
PROMPT_RESP=$(sncast invoke \
    --contract-address "$AGENT_ADDRESS" \
    --function pay_for_prompt \
    --arguments "$TWITTER_MESSAGE_ID, \"$PROMPT_TEXT\"" \
    --fee-token strk)

PROMPT_TX_HASH=$(echo "$PROMPT_RESP" | awk '/transaction_hash:/ {print $2}')

if [ -z "$PROMPT_TX_HASH" ]; then
    log "Error: Failed to get transaction hash from prompt payment response"
    exit 1
fi

# Wait for prompt transaction
wait_for_transaction "$PROMPT_TX_HASH" "prompt payment"

log "Successfully paid for prompt with tweet ID: $TWITTER_MESSAGE_ID"
