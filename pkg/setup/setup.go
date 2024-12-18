package setup

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
	"github.com/Dstack-TEE/teeception/pkg/utils/errors"
	"github.com/Dstack-TEE/teeception/pkg/utils/metrics"
)

const (
	SECURE_FILE_KEY           = "SECURE_FILE"
	DSTACK_TAPPD_ENDPOINT_KEY = "DSTACK_TAPPD_ENDPOINT"
	DEBUG_PLAIN_OUTPUT_KEY    = "DEBUG_PLAIN_OUTPUT"
)

func Setup(ctx context.Context, debug bool) (*SetupOutput, error) {
	start := time.Now()
	defer func() {
		metrics.GetDefaultCollector().RecordLatency(metrics.MetricSetupProcess, time.Since(start))
		slog.Info("setup completed",
			"duration", time.Since(start),
			"debug_mode", debug,
		)
	}()

	secureFilePath, ok := os.LookupEnv(SECURE_FILE_KEY)
	if !ok {
		return nil, errors.New(errors.TypeSetup,
			"secure file path environment variable not set",
			nil,
		)
	}

	dstackTappdClient := tappd.NewTappdClient(os.Getenv(DSTACK_TAPPD_ENDPOINT_KEY), slog.Default())

	sealingKeyResp, err := dstackTappdClient.DeriveKey(ctx, "/agent/sealing", "teeception", nil)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to derive sealing key",
			err,
		)
	}

	sealingKey, err := sealingKeyResp.ToBytes(32)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to convert sealing key to bytes",
			err,
		)
	}

	setupOutput, err := loadSetup(ctx, secureFilePath, sealingKey, debug)
	if err != nil {
		slog.Warn("failed to load setup, initializing new setup",
			"error", err,
			"debug_mode", debug,
		)
		return initializeSetup(ctx, secureFilePath, sealingKey, debug)
	}

	return setupOutput, nil
}

func initializeSetup(ctx context.Context, secureFilePath string, sealingKey []byte, debug bool) (*SetupOutput, error) {
	start := time.Now()
	defer func() {
		metrics.GetDefaultCollector().RecordLatency("setup_initialization", time.Since(start))
	}()

	setupManager, err := NewSetupManagerFromEnv()
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to create setup manager",
			err,
		)
	}

	setupOutput, err := setupManager.Setup(ctx, debug)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to setup",
			err,
		)
	}

	if err := writeSetupOutput(setupOutput, secureFilePath, sealingKey, debug); err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to write setup output",
			err,
		)
	}

	slog.Info("wrote encrypted setup output",
		"debug_mode", debug,
		"duration", time.Since(start),
	)

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
			return errors.New(errors.TypeSetup,
				"failed to marshal setup output",
				err,
			)
		}

		if err := os.WriteFile(filePath, plaintext, 0600); err != nil {
			return errors.New(errors.TypeSetup,
				"failed to write plaintext setup output",
				err,
			)
		}

		return nil
	}

	plaintext, err := json.Marshal(setupOutput)
	if err != nil {
		return errors.New(errors.TypeSetup,
			"failed to marshal setup output",
			err,
		)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return errors.New(errors.TypeSetup,
			"failed to create cipher",
			err,
		)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return errors.New(errors.TypeSetup,
			"failed to create GCM",
			err,
		)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return errors.New(errors.TypeSetup,
			"failed to create nonce",
			err,
		)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	if err := os.WriteFile(filePath, ciphertext, 0600); err != nil {
		return errors.New(errors.TypeSetup,
			"failed to write secure file",
			err,
		)
	}

	return nil
}

func readSetupOutput(filePath string, key []byte, debug bool) (*SetupOutput, error) {
	if debug && os.Getenv(DEBUG_PLAIN_OUTPUT_KEY) == "true" {
		slog.Info("reading plaintext setup output")

		file, err := os.Open(filePath)
		if err != nil {
			return nil, errors.New(errors.TypeSetup,
				"failed to open secure file",
				err,
			)
		}
		defer file.Close()

		var setupOutput SetupOutput
		if err := json.NewDecoder(file).Decode(&setupOutput); err != nil {
			return nil, errors.New(errors.TypeSetup,
				"failed to decode secure file",
				err,
			)
		}

		return &setupOutput, nil
	}

	ciphertext, err := os.ReadFile(filePath)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to read secure file",
			err,
		)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to create cipher",
			err,
		)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to create GCM",
			err,
		)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New(errors.TypeSetup,
			"ciphertext too short",
			nil,
		)
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to decrypt data",
			err,
		)
	}

	var setupOutput SetupOutput
	if err := json.Unmarshal(plaintext, &setupOutput); err != nil {
		return nil, errors.New(errors.TypeSetup,
			"failed to unmarshal setup output",
			err,
		)
	}

	return &setupOutput, nil
}
