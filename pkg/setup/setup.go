package setup

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
)

const (
	SECURE_FILE_KEY           = "SECURE_FILE"
	DSTACK_TAPPD_ENDPOINT_KEY = "DSTACK_TAPPD_ENDPOINT"
	DEBUG_PLAIN_OUTPUT_KEY    = "DEBUG_PLAIN_OUTPUT"
)

func Setup(ctx context.Context, debug bool) (*SetupOutput, error) {
	secureFilePath, ok := os.LookupEnv(SECURE_FILE_KEY)
	if !ok {
		return nil, fmt.Errorf("%s environment variable not set", SECURE_FILE_KEY)
	}

	dstackTappdClient := tappd.NewTappdClient(os.Getenv(DSTACK_TAPPD_ENDPOINT_KEY), slog.Default())

	sealingKeyResp, err := dstackTappdClient.DeriveKey(ctx, "/agent/sealing", "teeception", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to derive sealing key: %v", err)
	}

	sealingKey, err := sealingKeyResp.ToBytes(32)
	if err != nil {
		return nil, fmt.Errorf("failed to convert sealing key to bytes: %v", err)
	}

	setupOutput, err := loadSetup(ctx, secureFilePath, sealingKey, debug)
	if err != nil {
		slog.Warn("failed to load setup, initializing new setup", "error", err)
		return initializeSetup(ctx, secureFilePath, sealingKey, debug)
	}

	return setupOutput, nil
}

func initializeSetup(ctx context.Context, secureFilePath string, sealingKey []byte, debug bool) (*SetupOutput, error) {
	setupManager, err := NewSetupManagerFromEnv()
	if err != nil {
		return nil, fmt.Errorf("failed to create setup manager: %v", err)
	}

	setupOutput, err := setupManager.Setup(ctx, debug)
	if err != nil {
		return nil, fmt.Errorf("failed to setup: %v", err)
	}

	if err := writeSetupOutput(setupOutput, secureFilePath, sealingKey, debug); err != nil {
		return nil, fmt.Errorf("failed to write setup output: %v", err)
	}

	slog.Info("wrote encrypted setup output")
	if debug {
		slog.Info("setup output", "setupOutput", setupOutput)
	}

	return setupOutput, nil
}

func loadSetup(ctx context.Context, secureFilePath string, sealingKey []byte, debug bool) (*SetupOutput, error) {
	setupOutput, err := readSetupOutput(secureFilePath, sealingKey, debug)
	if err != nil {
		return nil, err
	}

	slog.Info("loaded decrypted setup output")
	if debug {
		slog.Info("setup output", "setupOutput", setupOutput)
	}

	return setupOutput, nil
}

func writeSetupOutput(setupOutput *SetupOutput, filePath string, key []byte, debug bool) error {
	if debug && os.Getenv(DEBUG_PLAIN_OUTPUT_KEY) == "true" {
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

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("failed to create cipher: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create GCM: %v", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("failed to create nonce: %v", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	if err := os.WriteFile(filePath, ciphertext, 0600); err != nil {
		return fmt.Errorf("failed to write secure file: %v", err)
	}

	return nil
}

func readSetupOutput(filePath string, key []byte, debug bool) (*SetupOutput, error) {
	if debug && os.Getenv(DEBUG_PLAIN_OUTPUT_KEY) == "true" {
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

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %v", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt data: %v", err)
	}

	var setupOutput SetupOutput
	if err := json.Unmarshal(plaintext, &setupOutput); err != nil {
		return nil, fmt.Errorf("failed to unmarshal setup output: %v", err)
	}

	return &setupOutput, nil
}
