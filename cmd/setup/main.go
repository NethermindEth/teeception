package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/NethermindEth/teeception/pkg/setup"
)

func main() {
	ctx := context.Background()
	setupManager, err := setup.NewSetupManagerFromEnv()
	if err != nil {
		slog.Error("failed to create setup manager", "error", err)
		os.Exit(1)
	}

	_, err = setupManager.Setup(ctx, true)
	if err != nil {
		slog.Error("failed to setup", "error", err)
		os.Exit(1)
	}
}
