package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/agent/setup"
)

func main() {
	ctx := context.Background()
	output, err := setup.Setup(ctx)
	if err != nil {
		slog.Error("failed to setup", "error", err)
		os.Exit(1)
	}

	twitterClientMode := os.Getenv("X_CLIENT_MODE")
	if twitterClientMode == "" {
		twitterClientMode = agent.TwitterClientModeApi
	}

	agent, err := agent.NewAgent(&agent.AgentConfig{
		TwitterClientMode:        twitterClientMode,
		TwitterUsername:          output.TwitterUsername,
		TwitterPassword:          output.TwitterPassword,
		TwitterConsumerKey:       output.TwitterConsumerKey,
		TwitterConsumerSecret:    output.TwitterConsumerSecret,
		TwitterAccessToken:       output.TwitterAccessToken,
		TwitterAccessTokenSecret: output.TwitterAccessTokenSecret,
		OpenAIKey:                output.OpenAIKey,
		StarknetRpcUrls:          output.StarknetRpcUrls,
		DstackTappdEndpoint:      output.DstackTappdEndpoint,
		StarknetPrivateKeySeed:   output.StarknetPrivateKeySeed,
		AgentRegistryAddress:     output.AgentRegistryAddress,
		TaskConcurrency:          10,
		TickRate:                 10 * time.Second,
		SafeBlockDelta:           0,
	})
	if err != nil {
		slog.Error("failed to create agent", "error", err)
		os.Exit(1)
	}

	err = agent.Run(ctx)
	if err != nil {
		slog.Error("failed to run agent", "error", err)
		os.Exit(1)
	}
}
