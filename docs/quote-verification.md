# Quote Verification Guide

This guide outlines the process for verifying a TDX quote from TEEception
based on the DStack platform.

## Prerequisites

- **Go ≥ 1.23.0**

## Steps

1. **Fetch the quote from the agent**

Get the agent's address and port (default is :8080), then make a GET request to /quote endpoint:

```
curl http://<agent-address>:<agent-port>/quote -o quote.json
```

2. **Get the App ID from Dstack**

This will be made available publicly in the DStack dashboard, and also by
the deployers.

3. **Verify the quote**

```
go run test/quote/verify/main.go -quote quote.json -app-id <app-id> --submit
```

This will fetch the TCB info from the DStack app, double-checking all relevant
metadata to make sure the program being executed is indeed the expected and the
TEE quote fields are valid. The quote will then be submitted to
[TEE Attestation Explorer](https://proof.t16z.com).

You'll also be able to see, from the quote, what is the TEE address on
Starknet, the configured contract address and the Twitter username. With that,
you can be sure that the agent actions are to be trusted!
