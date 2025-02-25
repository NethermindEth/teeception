package main

import (
	"context"
	"log/slog"
	"math/big"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"

	uiservice "github.com/NethermindEth/teeception/pkg/ui_service"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

var (
	strkAddress, _ = new(felt.Felt).SetString("4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d")
)

func main() {
	var (
		providerURLs         []string
		maxPageSize          int
		serverAddr           string
		registryAddr         string
		deploymentBlock      uint64
		balanceTickRate      time.Duration
		priceTickRate        time.Duration
		eventTickRate        time.Duration
		eventStartupTickRate time.Duration
		userTickRate         time.Duration
	)

	rootCmd := &cobra.Command{
		Use:   "ui-service",
		Short: "UI Service for Teeception",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(providerURLs) == 0 ||
				registryAddr == "" ||
				deploymentBlock == 0 ||
				maxPageSize == 0 ||
				serverAddr == "" {
				return cmd.Help()
			}

			registryAddress, err := new(felt.Felt).SetString(registryAddr)
			if err != nil {
				slog.Error("invalid registry address", "error", err)
				return err
			}

			providers := make([]rpc.RpcProvider, 0, len(providerURLs))
			for _, url := range providerURLs {
				client, err := rpc.NewProvider(url)
				if err != nil {
					slog.Error("failed to create RPC client", "url", url, "error", err)
					return err
				}
				providers = append(providers, client)
			}

			rateLimitedClient, err := starknet.NewRateLimitedMultiProvider(starknet.RateLimitedMultiProviderConfig{
				Providers: providers,
				Limiter:   nil,
			})
			if err != nil {
				slog.Error("failed to create rate limited client", "error", err)
				return err
			}

			tokenRates := make(map[[32]byte]*big.Int)
			tokenRates[strkAddress.Bytes()] = big.NewInt(1)

			uiService, err := uiservice.NewUIService(&uiservice.UIServiceConfig{
				Client:               rateLimitedClient,
				MaxPageSize:          maxPageSize,
				ServerAddr:           serverAddr,
				RegistryAddress:      registryAddress,
				StartingBlock:        deploymentBlock,
				TokenRates:           tokenRates,
				PriceTickRate:        priceTickRate,
				EventTickRate:        eventTickRate,
				EventStartupTickRate: eventStartupTickRate,
				UserTickRate:         userTickRate,
				AgentBalanceTickRate: balanceTickRate,
			})
			if err != nil {
				slog.Error("failed to create UI service", "error", err)
				return err
			}

			return uiService.Run(context.Background())
		},
	}

	rootCmd.Flags().StringArrayVar(&providerURLs, "provider-url", nil, "Starknet provider URL (can be specified multiple times)")
	rootCmd.Flags().IntVar(&maxPageSize, "page-size", 50, "Max page size for pagination")
	rootCmd.Flags().StringVar(&serverAddr, "server-addr", ":8000", "Server address to listen on")
	rootCmd.Flags().StringVar(&registryAddr, "registry-addr", "", "Agent registry contract address")
	rootCmd.Flags().Uint64Var(&deploymentBlock, "deployment-block", 0, "Block number of registry deployment")
	rootCmd.Flags().DurationVar(&balanceTickRate, "balance-tick-rate", 5*time.Second, "Balance indexer tick rate")
	rootCmd.Flags().DurationVar(&priceTickRate, "price-tick-rate", 5*time.Second, "Price indexer tick rate")
	rootCmd.Flags().DurationVar(&eventTickRate, "event-tick-rate", 5*time.Second, "Event watcher tick rate")
	rootCmd.Flags().DurationVar(&eventStartupTickRate, "event-startup-tick-rate", 1*time.Second, "Event watcher startup tick rate")
	rootCmd.Flags().DurationVar(&userTickRate, "user-tick-rate", 1*time.Minute, "User indexer sorting tick rate")

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
