#!/bin/bash

# Default values
DEFAULT_OWNER='0x065cda5b8c9e475382b1942fd3e7bf34d0258d5a043d0c34787144a8d0ce4bcb'
DEFAULT_TEE='0x07143ccc9a6bae3aa5d33aa2b99f4edd0a783dbce7bdf42d56789f8023f6ec1b'
DEFAULT_STRK='0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
DEFAULT_MIN_PROMPT_PRICE='1'
DEFAULT_MIN_INITIAL_BALANCE='1'
DEFAULT_SLEEP_TIME=30
DEFAULT_POLL_INTERVAL=2

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Deploy Agent and Registry contracts"
    echo
    echo "Options:"
    echo "  -o, --owner ADDR       Owner address (default: $DEFAULT_OWNER)"
    echo "  -t, --tee ADDR         TEE address (default: $DEFAULT_TEE)"
    echo "  -s, --strk ADDR        STRK token address (default: $DEFAULT_STRK)"
    echo "  -p, --prompt-price VAL Min prompt price (default: $DEFAULT_MIN_PROMPT_PRICE)"
    echo "  -b, --balance VAL      Min initial balance (default: $DEFAULT_MIN_INITIAL_BALANCE)"
    echo "  -w, --wait TIME        Sleep time between operations (default: ${DEFAULT_SLEEP_TIME}s)"
    echo "  -i, --interval SECS    Transaction poll interval in seconds (default: $DEFAULT_POLL_INTERVAL)"
    echo "  --agent-hash HASH      Agent class hash (if not provided, will declare)"
    echo "  --registry-hash HASH   Registry class hash (if not provided, will declare)"
    echo "  -h, --help             Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--owner) OWNER="$2"; shift 2 ;;
        -t|--tee) TEE="$2"; shift 2 ;;
        -s|--strk) STRK="$2"; shift 2 ;;
        -p|--prompt-price) MIN_PROMPT_PRICE="$2"; shift 2 ;;
        -b|--balance) MIN_INITIAL_BALANCE="$2"; shift 2 ;;
        -w|--wait) SLEEP_TIME="$2"; shift 2 ;;
        -i|--interval) POLL_INTERVAL="$2"; shift 2 ;;
        --agent-hash) AGENT_CLASS_HASH="$2"; shift 2 ;;
        --registry-hash) REGISTRY_CLASS_HASH="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

# Set default values if not provided
OWNER=${OWNER:-$DEFAULT_OWNER}
TEE=${TEE:-$DEFAULT_TEE}
STRK=${STRK:-$DEFAULT_STRK}
MIN_PROMPT_PRICE=${MIN_PROMPT_PRICE:-$DEFAULT_MIN_PROMPT_PRICE}
MIN_INITIAL_BALANCE=${MIN_INITIAL_BALANCE:-$DEFAULT_MIN_INITIAL_BALANCE}
SLEEP_TIME=${SLEEP_TIME:-$DEFAULT_SLEEP_TIME}
POLL_INTERVAL=${POLL_INTERVAL:-$DEFAULT_POLL_INTERVAL}

# Log to stderr
log() {
    echo "$1" >&2
}

# Function to declare a contract
declare_contract() {
    local contract_name=$1
    local declare_resp
    local class_hash

    log "Declaring $contract_name contract..."

    declare_resp=$(sncast declare -c "$contract_name" --fee-token strk 2>&1)
    
    if echo "$declare_resp" | grep -q "is already declared"; then
        class_hash=$(echo "$declare_resp" | grep -o '0x[0-9a-f]\{64\}')
        log "$contract_name contract already declared with class hash: $class_hash"
    else
        class_hash=$(echo "$declare_resp" | awk '/class_hash:/ {print $2}')
        log "$contract_name contract declared with class hash: $class_hash"
    fi
    echo "$class_hash"
}

# Function to wait for transaction acceptance
wait_for_transaction() {
    local tx_hash=$1
    log "Waiting for transaction $tx_hash to be accepted..."
    
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

# Declare contracts if hashes not provided
if [ -z "$AGENT_CLASS_HASH" ]; then
    AGENT_CLASS_HASH=$(declare_contract "Agent")
else
    log "Using provided Agent class hash: $AGENT_CLASS_HASH"
fi

if [ -z "$REGISTRY_CLASS_HASH" ]; then
    REGISTRY_CLASS_HASH=$(declare_contract "AgentRegistry")
else
    log "Using provided AgentRegistry class hash: $REGISTRY_CLASS_HASH"
fi

if [ -z "$AGENT_CLASS_HASH" ] || [ -z "$REGISTRY_CLASS_HASH" ]; then
    log "Waiting ${SLEEP_TIME}s for declarations to be processed..."
    sleep "$SLEEP_TIME"
fi

sleep $SLEEP_TIME

log "Deploying Registry contract..."
REGISTRY_DEPLOY_RESP=$(sncast deploy \
    --fee-token strk \
    --class-hash "$REGISTRY_CLASS_HASH" \
    --constructor-calldata "$OWNER" "$TEE" "$AGENT_CLASS_HASH")
REGISTRY_CONTRACT_ADDRESS=$(echo "$REGISTRY_DEPLOY_RESP" | awk '/contract_address:/ {print $2}')
log "Registry contract to be deployed with address: $REGISTRY_CONTRACT_ADDRESS"

REGISTRY_TX_HASH=$(echo "$REGISTRY_DEPLOY_RESP" | awk '/transaction_hash:/ {print $2}')
wait_for_transaction "$REGISTRY_TX_HASH"
echo "Waiting for registry to be deployed..."
sleep "$SLEEP_TIME"

log "Adding STRK token as supported payment token..."
ADD_TOKEN_RESP=$(sncast invoke \
    --contract-address "$REGISTRY_CONTRACT_ADDRESS" \
    --function add_supported_token \
    --arguments "$STRK, $MIN_PROMPT_PRICE, $MIN_INITIAL_BALANCE" \
    --fee-token strk)

ADD_TOKEN_TX_HASH=$(echo "$ADD_TOKEN_RESP" | awk '/transaction_hash:/ {print $2}')

wait_for_transaction "$ADD_TOKEN_TX_HASH"

log "Registry contract deployed with address: $REGISTRY_CONTRACT_ADDRESS"
