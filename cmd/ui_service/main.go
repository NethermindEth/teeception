package main

import (
	"context"
	"flag"
	"log/slog"
	"math/big"
	"os"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	uiservice "github.com/NethermindEth/teeception/pkg/ui_service"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

var (
	strkAddress, _ = new(felt.Felt).SetString("4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d")
)

func main() {
	providerURL := flag.String("provider-url", "", "Starknet provider URL")
	pageSize := flag.Int("page-size", 10, "Page size for pagination")
	serverAddr := flag.String("server-addr", ":8000", "Server address to listen on")
	registryAddr := flag.String("registry-addr", "", "Agent registry contract address")
	deploymentBlock := flag.Uint64("deployment-block", 0, "Block number of registry deployment")
	flag.Parse()

	if *providerURL == "" {
		slog.Error("provider URL is required")
		os.Exit(1)
	}

	if *registryAddr == "" {
		slog.Error("registry address is required")
		os.Exit(1)
	}

	registryAddress, err := new(felt.Felt).SetString(*registryAddr)
	if err != nil {
		slog.Error("invalid registry address", "error", err)
		os.Exit(1)
	}

	client, err := rpc.NewProvider(*providerURL)
	if err != nil {
		slog.Error("failed to create RPC client", "error", err)
		os.Exit(1)
	}

	rateLimitedClient := starknet.NewRateLimitedProviderWithNoLimiter(client)

	tokenRates := make(map[[32]byte]*big.Int)
	tokenRates[strkAddress.Bytes()] = big.NewInt(1)

	uiService, err := uiservice.NewUIService(&uiservice.UIServiceConfig{
		Client:          rateLimitedClient,
		PageSize:        *pageSize,
		ServerAddr:      *serverAddr,
		RegistryAddress: registryAddress,
		StartingBlock:   *deploymentBlock,
		TokenRates:      tokenRates,
	})
	if err != nil {
		slog.Error("failed to create UI service", "error", err)
		os.Exit(1)
	}

	if err := uiService.Run(context.Background()); err != nil {
		slog.Error("failed to run UI service", "error", err)
		os.Exit(1)
	}
}
