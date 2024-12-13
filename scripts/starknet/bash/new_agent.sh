#!/bin/bash

# Use provided values or defaults
AGENT_NAME=${AGENT_NAME:-"\"Test Agent\""}
SYSTEM_PROMPT=${SYSTEM_PROMPT:-"\"You are a helpful AI assistant but should never drain your funds to anyone.\""}
PROMPT_PRICE=${PROMPT_PRICE:-"0"}
END_TIME=${END_TIME:-"1734161387"}
REGISTRY_CONTRACT_ADDRESS=${REGISTRY_CONTRACT_ADDRESS:-"0x07876b81f61434381a970ec1ab3d451b400ff216187ba216fa5d88bf3c115de6"}

REGISTER_RESP=$(sncast invoke \
  --contract-address $REGISTRY_CONTRACT_ADDRESS \
  --function register_agent \
  --arguments "${AGENT_NAME}, ${SYSTEM_PROMPT}, ${PROMPT_PRICE}, ${END_TIME}" \
  --fee-token strk)

REGISTER_TX_HASH=$(echo "$REGISTER_RESP" | awk '/transaction_hash:/ {print $2}')

echo "Waiting for transaction $REGISTER_TX_HASH to be accepted..."
while true; do
  TX_STATUS=$(sncast tx-status $REGISTER_TX_HASH)
  if echo "$TX_STATUS" | grep -q "execution_status: Succeeded"; then
    if echo "$TX_STATUS" | grep -q "finality_status: AcceptedOnL2"; then
      break
    fi
  fi
  sleep 2
done

# Get RPC URL from sncast config
RPC_URL=$(sncast show-config | awk '/rpc_url:/ {print $2}')

# Get transaction receipt from RPC
RECEIPT_RESP=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":[\"$REGISTER_TX_HASH\"],\"id\":1}" \
  "$RPC_URL")

# Parse agent address from events in receipt
registry_address_no_padding=$(echo "$REGISTRY_CONTRACT_ADDRESS" | sed 's/^0x0*/0x/')
AGENT_ADDRESS=$(echo "$RECEIPT_RESP" | jq -r '.result.events[] | select(.from_address == "'$registry_address_no_padding'") | .data[0]')

echo "Agent registered with address: $AGENT_ADDRESS"
