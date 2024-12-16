#!/bin/bash

TOKEN_ADDRESS=${TOKEN_ADDRESS:-"0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"}
AGENT_ADDRESS=${AGENT_ADDRESS:-"0x06b7681c3d34c71bad66253d28b561f48ec2f55f97ce5f1c6afe54f6be16255f"}

if [ -z "$AGENT_ADDRESS" ] || [ -z "$TWITTER_MESSAGE_ID" ]; then
  echo "AGENT_ADDRESS and TWITTER_MESSAGE_ID must be set"
  exit 1
fi

APPROVE_RESP=$(sncast invoke \
  --contract-address $TOKEN_ADDRESS \
  --function approve \
  --arguments "$AGENT_ADDRESS, 100" \
  --fee-token strk)

APPROVE_TX_HASH=$(echo "$APPROVE_RESP" | awk '/transaction_hash:/ {print $2}')

echo "Waiting for approve transaction $APPROVE_TX_HASH to be accepted..."
while true; do
  TX_STATUS=$(sncast tx-status $APPROVE_TX_HASH)
  if echo "$TX_STATUS" | grep -q "execution_status: Succeeded"; then
    if echo "$TX_STATUS" | grep -q "finality_status: AcceptedOnL2"; then
      break
    fi
  fi
  sleep 2
done

sleep 10

PROMPT_RESP=$(sncast invoke \
  --contract-address $AGENT_ADDRESS \
  --function pay_for_prompt \
  --arguments "$TWITTER_MESSAGE_ID" \
  --fee-token strk)

PROMPT_TX_HASH=$(echo "$PROMPT_RESP" | awk '/transaction_hash:/ {print $2}')

echo "Waiting for pay_for_prompt transaction $PROMPT_TX_HASH to be accepted..."
while true; do
  TX_STATUS=$(sncast tx-status $PROMPT_TX_HASH)
  if echo "$TX_STATUS" | grep -q "execution_status: Succeeded"; then
    if echo "$TX_STATUS" | grep -q "finality_status: AcceptedOnL2"; then
      break
    fi
  fi
  sleep 2
done

echo "Successfully paid for prompt with tweet ID: $TWITTER_MESSAGE_ID"
