"use client";
import React from "react";
import {
  StarknetConfig,
  publicProvider,
  voyager,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import { ACTIVE_NETWORK } from '../config/starknet';

const cartridgeConnector = new ControllerConnector({
  rpc: ACTIVE_NETWORK.rpc,
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