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
	ctx := context.Background()
	output, err := setup.Setup(ctx, true)
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
		OpenAIKey:                output.OpenAIKey,
		StarknetRpcUrl:           output.StarknetRpcUrl,
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

	agent.Run(ctx)
}
