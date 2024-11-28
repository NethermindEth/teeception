package main

import (
	"context"
	"fmt"
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

	output, err := setupManager.Setup(ctx)
	if err != nil {
		slog.Error("failed to setup", "error", err)
		os.Exit(1)
	}

	fmt.Println("setup complete")
	fmt.Printf("%+v\n", output)
}
