package setup

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
)

const (
	SECURE_FILE_KEY = "SECURE_FILE"
)

func Setup(ctx context.Context, debug bool) (*SetupOutput, error) {
	secureFilePath, ok := os.LookupEnv(SECURE_FILE_KEY)
	if !ok {
		return nil, fmt.Errorf("%s environment variable not set", SECURE_FILE_KEY)
	}

	if _, err := os.Stat(secureFilePath); os.IsNotExist(err) {
		return initializeSetup(ctx, secureFilePath, debug)
	} else {
		return loadSetup(ctx, secureFilePath, debug)
	}
}

func initializeSetup(ctx context.Context, secureFilePath string, debug bool) (*SetupOutput, error) {
	setupManager, err := NewSetupManagerFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to create setup manager: %v", err)
	}

	setupOutput, err := setupManager.Setup(ctx, debug)
	if err != nil {
		return nil, fmt.Errorf("failed to setup: %v", err)
	}

	secureFile, err := os.Create(secureFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create secure file: %v", err)
	}
	defer secureFile.Close()

	json.NewEncoder(secureFile).Encode(setupOutput)

	if debug {
		slog.Info("wrote setup output", "setupOutput", setupOutput)
	}

	return setupOutput, nil
}

func loadSetup(ctx context.Context, secureFilePath string, debug bool) (*SetupOutput, error) {
	var setupOutput SetupOutput

	secureFile, err := os.Open(secureFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open secure file: %v", err)
	}
	defer secureFile.Close()

	if err := json.NewDecoder(secureFile).Decode(&setupOutput); err != nil {
		return nil, fmt.Errorf("failed to decode secure file: %v", err)
	}

	if debug {
		slog.Info("loaded setup output", "setupOutput", setupOutput)
	}

	return &setupOutput, nil
}
