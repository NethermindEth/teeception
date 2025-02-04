package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/agent/setup"
	"github.com/NethermindEth/teeception/pkg/twitter"
)

func main_impl() error {
	ctx := context.Background()
	output, err := setup.Setup(ctx)
	if err != nil {
		return fmt.Errorf("failed to setup: %w", err)
	}

	twitterClientMode := os.Getenv("X_CLIENT_MODE")
	if twitterClientMode == "" {
		twitterClientMode = agent.TwitterClientModeApi
	}

	unencumberData, err := setup.NewUnencumberDataFromSetupOutput(output)
	if err != nil {
		return fmt.Errorf("failed to create unencumber data: %w", err)
	}

	agentConfig, err := agent.NewAgentConfigFromParams(&agent.AgentConfigParams{
		TwitterClientMode: twitterClientMode,
		TwitterClientConfig: &twitter.TwitterClientConfig{
			Username:          output.TwitterUsername,
			Password:          output.TwitterPassword,
			Email:             output.ProtonEmail,
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
		return fmt.Errorf("failed to create agent config: %w", err)
	}

	agent, err := agent.NewAgent(agentConfig)
	if err != nil {
		return fmt.Errorf("failed to create agent: %w", err)
	}

	err = agent.Run(ctx)
	if err != nil {
		return fmt.Errorf("failed to run agent: %w", err)
	}

	return nil
}

func main() {
	var lastError error
	if err := main_impl(); err != nil {
		lastError = err
		slog.Error("failed to run agent", "error", err)

		// Set up HTTP handler to return the error
		http.HandleFunc("/error", func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, "agent error: %v", lastError)
		})

		// Start HTTP server and hang
		slog.Info("Starting error reporting server on :8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			slog.Error("HTTP server failed", "error", err)
		}
	}

	os.Exit(0)
}
