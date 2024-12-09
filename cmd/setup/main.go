package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/NethermindEth/teeception/pkg/setup"
)

func main() {
	ctx := context.Background()
	_, err := setup.Setup(ctx, true)
	if err != nil {
		slog.Error("failed to setup", "error", err)
		os.Exit(1)
	}
}
