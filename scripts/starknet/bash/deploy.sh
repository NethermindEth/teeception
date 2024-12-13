#!/bin/bash

TEE='0x0075d20cddf35d960f826443a933aaec825a298ff79b26aecf1abc07d6738c1e'
STRK='0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
REGISTRATION_PRICE='0x0 0x0' # u256 requires 2 felts

# Attempt to declare Agent contract and handle potential "already declared" error
AGENT_DECLARE_RESP=$(sncast declare -c Agent --fee-token strk 2>&1)
if echo "$AGENT_DECLARE_RESP" | grep -q "is already declared"; then
    AGENT_CLASS_HASH=$(echo "$AGENT_DECLARE_RESP" | grep -o '0x[0-9a-f]\{64\}')
    echo "Agent contract already declared with class hash: $AGENT_CLASS_HASH"
else
    AGENT_CLASS_HASH=$(echo "$AGENT_DECLARE_RESP" | awk '/class_hash:/ {print $2}')
    echo "Agent contract declared with class hash: $AGENT_CLASS_HASH"
fi

# Attempt to declare Registry contract and handle potential "already declared" error
REGISTRY_DECLARE_RESP=$(sncast declare -c AgentRegistry --fee-token strk 2>&1)
if echo "$REGISTRY_DECLARE_RESP" | grep -q "is already declared"; then
    REGISTRY_CLASS_HASH=$(echo "$REGISTRY_DECLARE_RESP" | grep -o '0x[0-9a-f]\{64\}')
    echo "Registry contract already declared with class hash: $REGISTRY_CLASS_HASH"
else
    REGISTRY_CLASS_HASH=$(echo "$REGISTRY_DECLARE_RESP" | awk '/class_hash:/ {print $2}')
    echo "Registry contract declared with class hash: $REGISTRY_CLASS_HASH"
fi

REGISTRY_DEPLOY_RESP=$(sncast deploy --fee-token strk --class-hash $REGISTRY_CLASS_HASH --constructor-calldata $TEE $AGENT_CLASS_HASH $STRK $REGISTRATION_PRICE)
REGISTRY_CONTRACT_ADDRESS=$(echo "$REGISTRY_DEPLOY_RESP" | awk '/contract_address:/ {print $2}')

echo "Registry contract deployed with address: $REGISTRY_CONTRACT_ADDRESS"
