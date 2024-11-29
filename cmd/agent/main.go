package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/setup"
)

func main() {
	setupManager, err := setup.NewSetupManagerFromEnv()
	if err != nil {
		slog.Error("failed to create setup manager", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()
	output, err := setupManager.Setup(ctx)
	if err != nil {
		slog.Error("failed to setup", "error", err)
		os.Exit(1)
	}

	agent, err := agent.NewAgent(&agent.AgentConfig{
		TwitterUsername:          output.TwitterUsername,
		TwitterConsumerKey:       output.TwitterConsumerKey,
		TwitterConsumerSecret:    output.TwitterConsumerSecret,
		TwitterAccessToken:       output.TwitterAccessToken,
		TwitterAccessTokenSecret: output.TwitterAccessTokenSecret,

		EthPrivateKey:   output.EthPrivateKey,
		EthRpcUrl:       output.EthRpcUrl,
		ContractAddress: output.ContractAddress,

		TickRate:        60 * time.Second,
		TaskConcurrency: 10,

		OpenAIKey: output.OpenAIKey,
	})
	if err != nil {
		slog.Error("failed to create agent", "error", err)
		os.Exit(1)
	}

	agent.Run(ctx)
}
