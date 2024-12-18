package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/setup"
	"github.com/NethermindEth/teeception/pkg/utils/errors"
	"github.com/NethermindEth/teeception/pkg/utils/logger"
	"github.com/NethermindEth/teeception/pkg/utils/metrics"
)

func setupMonitoring(metricsCollector *metrics.MetricsCollector) {
	// Metrics endpoint
	http.HandleFunc("/metrics", metricsCollector.ServeHTTP)

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Start server in a goroutine
	go func() {
		if err := http.ListenAndServe(":8080", nil); err != nil {
			slog.Error("monitoring server failed",
				"error", err,
				"type", errors.TypeSetup,
			)
		}
	}()

	slog.Info("monitoring endpoints started", "port", 8080)
}

func main() {
	ctx := context.Background()

	// Initialize logger with JSON format for production
	logger.SetDefault(logger.Config{
		Level:      slog.LevelInfo,
		Output:     os.Stdout,
		JSONFormat: true,
	})

	// Initialize metrics collector
	metricsCollector := metrics.NewMetricsCollector()

	// Set up monitoring endpoints
	setupMonitoring(metricsCollector)

	// Track setup process duration
	setupStart := time.Now()
	output, err := setup.Setup(ctx, true)
	metricsCollector.RecordLatency(metrics.MetricSetupProcess, time.Since(setupStart))
	if err != nil {
		slog.Error("failed to setup",
			"error", err,
			"type", errors.TypeSetup,
			"stack", err.(*errors.Error).Stack,
		)
		os.Exit(1)
	}

	// Initialize agent with configuration
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
		slog.Error("failed to create agent",
			"error", err,
			"type", errors.TypeAgent,
			"stack", err.(*errors.Error).Stack,
		)
		os.Exit(1)
	}

	agent.Run(ctx)
}
