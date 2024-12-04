package setup

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log/slog"
	"os"

	"github.com/NethermindEth/teeception/pkg/encumber/proton"
	"github.com/NethermindEth/teeception/pkg/encumber/twitter"
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
	loginServerIp    string
	loginServerPort  string
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
		loginServerIp:    getEnv("X_LOGIN_SERVER_IP"),
		loginServerPort:  getEnv("X_LOGIN_SERVER_PORT"),
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

func (m *SetupManager) Setup(ctx context.Context, debug bool) (*SetupOutput, error) {
	protonEncumberer := proton.NewProtonEncumberer(proton.ProtonEncumbererCredentials{
		ProtonUsername: m.protonEmail,
		ProtonPassword: m.protonPassword,
	}, debug)

	twitterEncumberer := twitter.NewTwitterEncumberer(twitter.TwitterEncumbererCredentials{
		TwitterUsername:  m.twitterAccount,
		TwitterPassword:  m.twitterPassword,
		TwitterEmail:     m.protonEmail,
		TwitterAppKey:    m.twitterAppKey,
		TwitterAppSecret: m.twitterAppSecret,
	}, m.loginServerIp, m.loginServerPort, func(ctx context.Context) (string, error) {
		return protonEncumberer.GetTwitterVerificationCode(ctx)
	}, debug)

	twitterEncumbererOutput, err := twitterEncumberer.Encumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to encumber twitter: %v", err)
	}

	protonEncumbererOutput, err := protonEncumberer.Encumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to encumber proton: %v", err)
	}

	ethPrivateKey := GeneratePrivateKey()

	contractAddress, err := types.AddressFromHex(m.contractAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to parse contract address: %v", err)
	}

	output := &SetupOutput{
		TwitterAuthTokens:        twitterEncumbererOutput.AuthTokens,
		TwitterAccessToken:       twitterEncumbererOutput.OAuthTokenPair.Token,
		TwitterAccessTokenSecret: twitterEncumbererOutput.OAuthTokenPair.TokenSecret,
		TwitterConsumerKey:       m.twitterAppKey,
		TwitterConsumerSecret:    m.twitterAppSecret,
		TwitterUsername:          m.twitterAccount,
		TwitterPassword:          twitterEncumbererOutput.NewPassword,
		ProtonPassword:           protonEncumbererOutput.NewPassword,
		EthPrivateKey:            ethPrivateKey,
		EthRpcUrl:                m.ethRpcUrl,
		ContractAddress:          contractAddress,
		OpenAIKey:                m.openAiKey,
	}

	if debug {
		slog.Info("setup output", "output", fmt.Sprintf("%+v\n", output))
	}

	return output, nil
}
