package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/agent/setup"
	"github.com/NethermindEth/teeception/pkg/twitter"
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

	unencumberData, err := setup.NewUnencumberDataFromSetupOutput(output)
	if err != nil {
		slog.Error("failed to create unencumber data", "error", err)
		os.Exit(1)
	}

	agentConfig, err := agent.NewAgentConfigFromParams(&agent.AgentConfigParams{
		TwitterClientMode: twitterClientMode,
		TwitterClientConfig: &twitter.TwitterClientConfig{
			Username:          output.TwitterUsername,
			Password:          output.TwitterPassword,
			ConsumerKey:       output.TwitterConsumerKey,
			ConsumerSecret:    output.TwitterConsumerSecret,
			AccessToken:       output.TwitterAccessToken,
			AccessTokenSecret: output.TwitterAccessTokenSecret,
		},
		IsUnencumbered:               false,
		UnencumberData:               unencumberData,
		OpenAIKey:                    output.OpenAIKey,
		StarknetRpcUrls:              output.StarknetRpcUrls,
		DstackTappdEndpoint:          output.DstackTappdEndpoint,
		StarknetPrivateKeySeed:       output.StarknetPrivateKeySeed,
		AgentRegistryAddress:         output.AgentRegistryAddress,
		AgentRegistryDeploymentBlock: output.AgentRegistryDeploymentBlock,
		TaskConcurrency:              10,
		TickRate:                     10 * time.Second,
		SafeBlockDelta:               0,
	})
	if err != nil {
		slog.Error("failed to create agent config", "error", err)
		os.Exit(1)
	}

	agent, err := agent.NewAgent(agentConfig)
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
