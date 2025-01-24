#!/bin/bash

# Default values
DEFAULT_OWNER='0x065cda5b8c9e475382b1942fd3e7bf34d0258d5a043d0c34787144a8d0ce4bcb'
DEFAULT_TEE='0x0075d20cddf35d960f826443a933aaec825a298ff79b26aecf1abc07d6738c1e'
DEFAULT_STRK='0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
DEFAULT_REGISTRATION_PRICE='0'
DEFAULT_STRK_MIN_PROMPT_PRICE='1000000000000000000'
DEFAULT_SLEEP_TIME=30

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Deploy Agent and Registry contracts"
    echo
    echo "Options:"
    echo "  -o, --owner ADDR       Owner address (default: $DEFAULT_OWNER)"
    echo "  -t, --tee ADDR         TEE address (default: $DEFAULT_TEE)"
    echo "  -s, --strk ADDR        STRK token address (default: $DEFAULT_STRK)"
    echo "  -r, --reg-price PRICE  Registration price (default: $DEFAULT_REGISTRATION_PRICE)"
    echo "  -p, --prompt-price VAL Min prompt price (default: $DEFAULT_STRK_MIN_PROMPT_PRICE)"
    echo "  -w, --wait TIME        Sleep time between operations (default: ${DEFAULT_SLEEP_TIME}s)"
    echo "  -h, --help             Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--owner) OWNER="$2"; shift 2 ;;
        -t|--tee) TEE="$2"; shift 2 ;;
        -s|--strk) STRK="$2"; shift 2 ;;
        -r|--reg-price) REGISTRATION_PRICE="$2"; shift 2 ;;
        -p|--prompt-price) STRK_MIN_PROMPT_PRICE="$2"; shift 2 ;;
        -w|--wait) SLEEP_TIME="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

# Set default values if not provided
OWNER=${OWNER:-$DEFAULT_OWNER}
TEE=${TEE:-$DEFAULT_TEE}
STRK=${STRK:-$DEFAULT_STRK}
REGISTRATION_PRICE=${REGISTRATION_PRICE:-$DEFAULT_REGISTRATION_PRICE}
STRK_MIN_PROMPT_PRICE=${STRK_MIN_PROMPT_PRICE:-$DEFAULT_STRK_MIN_PROMPT_PRICE}
SLEEP_TIME=${SLEEP_TIME:-$DEFAULT_SLEEP_TIME}

# Split registration price into low and high parts using bc for large number handling
REG_PRICE_HIGH=$(echo "scale=0; $REGISTRATION_PRICE / (2^128)" | bc)
REG_PRICE_LOW=$(echo "scale=0; $REGISTRATION_PRICE % (2^128)" | bc)

# Convert to hex with proper padding
REG_PRICE_HIGH=$(printf "0x%x" "$REG_PRICE_HIGH")
REG_PRICE_LOW=$(printf "0x%x" "$REG_PRICE_LOW")

# Function to declare a contract
declare_contract() {
    local contract_name=$1
    local declare_resp
    local class_hash
    
    echo "Declaring $contract_name contract..."
    declare_resp=$(sncast declare -c "$contract_name" --fee-token strk 2>&1)
    
    if echo "$declare_resp" | grep -q "is already declared"; then
        class_hash=$(echo "$declare_resp" | grep -o '0x[0-9a-f]\{64\}')
        echo "$contract_name contract already declared with class hash: $class_hash"
    else
        class_hash=$(echo "$declare_resp" | awk '/class_hash:/ {print $2}')
        echo "$contract_name contract declared with class hash: $class_hash"
    fi
    echo "$class_hash"
}

# Declare contracts
AGENT_CLASS_HASH=$(declare_contract "Agent")
REGISTRY_CLASS_HASH=$(declare_contract "AgentRegistry")

echo "Waiting ${SLEEP_TIME}s for declarations to be processed..."
sleep "$SLEEP_TIME"

echo "Deploying Registry contract..."
REGISTRY_DEPLOY_RESP=$(sncast deploy \
    --fee-token strk \
    --class-hash "$REGISTRY_CLASS_HASH" \
    --constructor-calldata "$OWNER" "$TEE" "$AGENT_CLASS_HASH" "$STRK" "$REG_PRICE_HIGH" "$REG_PRICE_LOW")
REGISTRY_CONTRACT_ADDRESS=$(echo "$REGISTRY_DEPLOY_RESP" | awk '/contract_address:/ {print $2}')

echo "Adding STRK token as supported payment token..."
sncast invoke \
    --contract-address "$REGISTRY_CONTRACT_ADDRESS" \
    --function add_supported_token \
    --arguments "$STRK, $STRK_MIN_PROMPT_PRICE" \
    --fee-token strk

echo "Waiting ${SLEEP_TIME}s for deployment to be processed..."
sleep "$SLEEP_TIME"

echo "Registry contract deployed with address: $REGISTRY_CONTRACT_ADDRESS"
