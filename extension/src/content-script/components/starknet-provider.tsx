"use client";
import React from "react";
 
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  voyager,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";

const cartridgeConnector = new ControllerConnector({
  rpc: "https://api.cartridge.gg/x/starknet/mainnet",
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={publicProvider()}
      connectors={[cartridgeConnector ]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}