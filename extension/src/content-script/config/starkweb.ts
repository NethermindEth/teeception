import { createConfig } from "starkweb/react";
import { getDefaultConfig } from "starkwebkit";
import { mainnet, sepolia } from "starkweb/chains";

export const starkwebConfig = createConfig(
    getDefaultConfig({
        appName: 'Jack the Ether',
        chains: [mainnet, sepolia],
        walletConnectProjectId: "",
    })
);