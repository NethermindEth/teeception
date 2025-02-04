"use client";
import React from "react";
import {
  StarknetConfig,
  publicProvider,
  voyager,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import { ACTIVE_NETWORK } from '../config/starknet';

const policies = {
  contracts: {
    [ACTIVE_NETWORK.agentRegistryAddress]: {
      name: "Agent Registry",
      description: "Allows interaction with the Agent Registry contract",
      methods: [
        {
          name: "Register Agent",
          description: "Register a new AI agent",
          entrypoint: "register_agent"
        },
        {
          name: "Transfer Agent",
          description: "Transfer ownership of an agent",
          entrypoint: "transfer"
        }
      ]
    }
  }
};

const cartridgeConnector = new ControllerConnector({
  policies,
  defaultChainId: ACTIVE_NETWORK.chainId,
  chains: [
    { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia" },
    { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet" },
  ],
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={[ACTIVE_NETWORK.chain]}
      provider={publicProvider()}
      connectors={[cartridgeConnector]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}