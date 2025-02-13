# Quote Verification Guide

This guide explains how to verify TDX quotes from TEEception agents running on the DStack platform. Quote verification ensures the authenticity and integrity of TEE-based operations.

## Prerequisites

- **Go ≥ 1.23.0**

## Steps

1. **Obtain the Quote**

   Request a quote from your TEEception agent:

   ```bash
   curl http://<agent-address>:<agent-port>/quote -o quote.json
   ```

   The default port is 8080 if not specified otherwise.

2. **Retrieve the App ID**

   Get the App ID from either:
   - The public DStack dashboard
   - The TEEception deployment team

3. **Verify and Submit**

   Run the verification tool:

   ```bash
   go run cmd/verify/main.go -quote quote.json -app-id <app-id> --submit
   ```

   The tool performs several important checks:
   - Fetches and validates TCB (Trusted Computing Base) information from DStack
   - Verifies program integrity and execution environment based on the TCB and
   the TEE quote
   - Submits the verified quote to the [TEE Attestation Explorer](https://proof.t16z.com)

   Upon successful verification, you can view critical information from the quote:
   - The TEE's Starknet address
   - The configured contract address
   - The associated Twitter username

   These details provide cryptographic proof that the agent's actions are authentic and trustworthy.
