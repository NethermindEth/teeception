package setup

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"

	"github.com/NethermindEth/teeception/pkg/agent/debug"
)

func Setup(ctx context.Context) (*SetupOutput, error) {
	secureFilePath, err := envLookupSecureFile()
	if err != nil {
		return nil, fmt.Errorf("failed to get secure file: %v", err)
	}

	dstackTappdEndpoint := envGetDstackTappdEndpoint()
	dstackTappdClient := tappd.NewTappdClient(tappd.WithEndpoint(dstackTappdEndpoint))

	sealingKeyResp, err := dstackTappdClient.DeriveKeyWithSubject(ctx, "/agent/sealing", "teeception")
	if err != nil {
		return nil, fmt.Errorf("failed to derive sealing key: %v", err)
	}

	sealingKey, err := sealingKeyResp.ToBytes(32)
	if err != nil {
		return nil, fmt.Errorf("failed to convert sealing key to bytes: %v", err)
	}

	setupOutput, err := loadSetup(ctx, secureFilePath, sealingKey)
	if err != nil {
		slog.Warn("failed to load setup, initializing new setup", "error", err)
		return initializeSetup(ctx, secureFilePath, sealingKey)
	}

	return setupOutput, nil
}

func initializeSetup(ctx context.Context, secureFilePath string, sealingKey []byte) (*SetupOutput, error) {
	setupManager, err := NewSetupManagerFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to create setup manager: %v", err)
	}

	setupOutput, err := setupManager.Setup(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to setup: %v", err)
	}

	if err := writeSetupOutput(setupOutput, secureFilePath, sealingKey); err != nil {
		return nil, fmt.Errorf("failed to write setup output: %v", err)
	}

	slog.Info("wrote encrypted setup output")
	if debug.IsDebugShowSetup() {
		slog.Info("setup output", "setupOutput", setupOutput)
	}

	return setupOutput, nil
}

func loadSetup(ctx context.Context, secureFilePath string, sealingKey []byte) (*SetupOutput, error) {
	setupOutput, err := readSetupOutput(secureFilePath, sealingKey)
	if err != nil {
		return nil, err
	}

	slog.Info("loaded decrypted setup output")
	if debug.IsDebugShowSetup() {
		slog.Info("setup output", "setupOutput", setupOutput)
	}

	return setupOutput, nil
}

func writeSetupOutput(setupOutput *SetupOutput, filePath string, key []byte) error {
	if debug.IsDebugPlainSetup() {
		slog.Info("writing plaintext setup output")

		plaintext, err := json.Marshal(setupOutput)
		if err != nil {
			return fmt.Errorf("failed to marshal setup output: %v", err)
		}

		if err := os.WriteFile(filePath, plaintext, 0600); err != nil {
			return fmt.Errorf("failed to write plaintext setup output: %v", err)
		}

		return nil
	}

	plaintext, err := json.Marshal(setupOutput)
	if err != nil {
		return fmt.Errorf("failed to marshal setup output: %v", err)
	}

	ciphertext, err := encrypt(plaintext, key)
	if err != nil {
		return fmt.Errorf("failed to encrypt setup output: %v", err)
	}

	if err := os.WriteFile(filePath, ciphertext, 0600); err != nil {
		return fmt.Errorf("failed to write secure file: %v", err)
	}

	return nil
}

func readSetupOutput(filePath string, key []byte) (*SetupOutput, error) {
	if debug.IsDebugPlainSetup() {
		slog.Info("reading plaintext setup output")

		file, err := os.Open(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open secure file: %v", err)
		}
		defer file.Close()

		var setupOutput SetupOutput
		if err := json.NewDecoder(file).Decode(&setupOutput); err != nil {
			return nil, fmt.Errorf("failed to decode secure file: %v", err)
		}

		return &setupOutput, nil
	}

	ciphertext, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read secure file: %v", err)
	}

	plaintext, err := decrypt(ciphertext, key)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt setup output: %v", err)
	}

	var setupOutput SetupOutput
	if err := json.Unmarshal(plaintext, &setupOutput); err != nil {
		return nil, fmt.Errorf("failed to unmarshal setup output: %v", err)
	}

	return &setupOutput, nil
}
