package setup

import (
	"context"
	"fmt"
	"log/slog"
	"os"
)

type SetupManager struct {
	twitterAccount   string
	twitterPassword  string
	protonEmail      string
	protonPassword   string
	twitterAppKey    string
	twitterAppSecret string
	loginServerUrl   string
}

type SetupOutput struct {
	TwitterPassword       string
	ProtonPassword        string
	TwitterConsumerKey    string
	TwitterConsumerSecret string
	TwitterAuthTokens     string
	TwitterAccessToken    string
	TwitterTokenSecret    string
}

func getEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		slog.Warn("environment variable not found", "key", key)
	}
	return value
}

func NewSetupManagerFromEnv() (*SetupManager, error) {
	setupManager := &SetupManager{
		twitterAccount:   getEnv("X_USERNAME"),
		twitterPassword:  getEnv("X_PASSWORD"),
		protonEmail:      getEnv("PROTONMAIL_EMAIL"),
		protonPassword:   getEnv("PROTONMAIL_PASSWORD"),
		twitterAppKey:    getEnv("X_CONSUMER_KEY"),
		twitterAppSecret: getEnv("X_CONSUMER_SECRET"),
		loginServerUrl:   "http://127.0.0.1:3000",
	}

	if err := setupManager.Validate(); err != nil {
		return nil, err
	}

	return setupManager, nil
}

func (m *SetupManager) Validate() error {
	if m.twitterAccount == "" || m.twitterPassword == "" {
		return fmt.Errorf("invalid twitter credentials")
	}

	if m.protonEmail == "" || m.protonPassword == "" {
		return fmt.Errorf("invalid proton credentials")
	}

	if m.twitterAppKey == "" || m.twitterAppSecret == "" {
		return fmt.Errorf("invalid twitter app credentials")
	}

	return nil
}

func (m *SetupManager) Setup(ctx context.Context) (*SetupOutput, error) {
	twitterPassword, err := m.ChangeTwitterPassword()
	if err != nil {
		return nil, fmt.Errorf("failed to change twitter password: %v", err)
	}

	protonPassword, err := m.ChangeProtonPassword()
	if err != nil {
		return nil, fmt.Errorf("failed to change proton password: %v", err)
	}

	twitterAuthTokens, twitterTokenPair, err := m.GetTwitterTokens(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get twitter tokens: %v", err)
	}

	return &SetupOutput{
		TwitterAuthTokens:     twitterAuthTokens,
		TwitterAccessToken:    twitterTokenPair.Token,
		TwitterTokenSecret:    twitterTokenPair.Secret,
		TwitterConsumerKey:    m.twitterAppKey,
		TwitterConsumerSecret: m.twitterAppSecret,
		TwitterPassword:       twitterPassword,
		ProtonPassword:        protonPassword,
	}, nil
}
