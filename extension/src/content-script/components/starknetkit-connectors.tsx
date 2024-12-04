import { InjectedConnector } from "starknetkit/injected";
import { WebWalletConnector } from "starknetkit/webwallet";

export const availableConnectors = [
  new InjectedConnector({ options: { id: "argentX" } }),
  new InjectedConnector({ options: { id: "braavos" } }),
  new WebWalletConnector({ url: "https://web.argent.xyz" }),
];
