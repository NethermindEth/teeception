package setup

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log/slog"
	"os"

	"github.com/defiweb/go-eth/types"
)

type SetupManager struct {
	twitterAccount   string
	twitterPassword  string
	protonEmail      string
	protonPassword   string
	twitterAppKey    string
	twitterAppSecret string
	ethRpcUrl        string
	contractAddress  string
	openAiKey        string
	loginServerUrl   string
}

type SetupOutput struct {
	TwitterUsername          string
	TwitterPassword          string
	ProtonPassword           string
	TwitterConsumerKey       string
	TwitterConsumerSecret    string
	TwitterAuthTokens        string
	TwitterAccessToken       string
	TwitterAccessTokenSecret string
	EthPrivateKey            *ecdsa.PrivateKey
	EthRpcUrl                string
	ContractAddress          types.Address
	OpenAIKey                string
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
		ethRpcUrl:        getEnv("ETH_RPC_URL"),
		contractAddress:  getEnv("CONTRACT_ADDRESS"),
		openAiKey:        getEnv("OPENAI_API_KEY"),
		loginServerUrl:   getEnv("X_LOGIN_SERVER_URL"),
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

	ethPrivateKey := GeneratePrivateKey()

	contractAddress, err := types.AddressFromHex(m.contractAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to parse contract address: %v", err)
	}

	return &SetupOutput{
		TwitterAuthTokens:        twitterAuthTokens,
		TwitterAccessToken:       twitterTokenPair.Token,
		TwitterAccessTokenSecret: twitterTokenPair.Secret,
		TwitterConsumerKey:       m.twitterAppKey,
		TwitterConsumerSecret:    m.twitterAppSecret,
		TwitterUsername:          m.twitterAccount,
		TwitterPassword:          twitterPassword,
		ProtonPassword:           protonPassword,
		EthPrivateKey:            ethPrivateKey,
		EthRpcUrl:                m.ethRpcUrl,
		ContractAddress:          contractAddress,
		OpenAIKey:                m.openAiKey,
	}, nil
}
