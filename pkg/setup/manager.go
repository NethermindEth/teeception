package setup

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/NethermindEth/juno/core/felt"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/NethermindEth/teeception/pkg/encumber/proton"
	"github.com/NethermindEth/teeception/pkg/encumber/twitter"
	"github.com/NethermindEth/teeception/pkg/twitter"
	snaccount "github.com/NethermindEth/teeception/pkg/utils/wallet/starknet"
)

type SetupManager struct {
	twitterAccount       string
	twitterPassword      string
	protonEmail          string
	protonPassword       string
	twitterAppKey        string
	twitterAppSecret     string
	starknetRpcUrl       string
	agentRegistryAddress string
	openAiKey            string
	loginServerIp        string
	loginServerPort      string
	dstackTappdEndpoint  string
}

type SetupOutput struct {
	TwitterConfig           *twitter.TwitterConfig `json:"twitter_config"`
	ProtonPassword         string                `json:"proton_password"`
	StarknetPrivateKeySeed []byte                `json:"starknet_private_key_seed"`
	StarknetRpcUrl         string                `json:"starknet_rpc_url"`
	AgentRegistryAddress   *felt.Felt            `json:"agent_registry_address"`
	OpenAIKey              string                `json:"openai_key"`
	DstackTappdEndpoint    string                `json:"dstack_tappd_endpoint"`
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
		twitterAccount:       getEnv("X_USERNAME"),
		twitterPassword:      getEnv("X_PASSWORD"),
		protonEmail:          getEnv("PROTONMAIL_EMAIL"),
		protonPassword:       getEnv("PROTONMAIL_PASSWORD"),
		twitterAppKey:        getEnv("X_CONSUMER_KEY"),
		twitterAppSecret:     getEnv("X_CONSUMER_SECRET"),
		starknetRpcUrl:       getEnv("STARKNET_RPC_URL"),
		agentRegistryAddress: getEnv("CONTRACT_ADDRESS"),
		openAiKey:            getEnv("OPENAI_API_KEY"),
		loginServerIp:        getEnv("X_LOGIN_SERVER_IP"),
		loginServerPort:      getEnv("X_LOGIN_SERVER_PORT"),
		dstackTappdEndpoint:  getEnv("DSTACK_TAPPD_ENDPOINT"),
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
	agentRegistryAddress, err := starknetgoutils.HexToFelt(m.agentRegistryAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to parse agent registry address: %v", err)
	}

	starknetPrivateKeySeed := snaccount.NewPrivateKey(nil).Bytes()

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

	output := &SetupOutput{
		TwitterConfig: &twitter.TwitterConfig{
			Username:          m.twitterAccount,
			ConsumerKey:       m.twitterAppKey,
			ConsumerSecret:    m.twitterAppSecret,
			AccessToken:       twitterEncumbererOutput.OAuthTokenPair.Token,
			AccessTokenSecret: twitterEncumbererOutput.OAuthTokenPair.TokenSecret,
		},
		ProtonPassword:         protonEncumbererOutput.NewPassword,
		StarknetPrivateKeySeed: starknetPrivateKeySeed[:],
		StarknetRpcUrl:         m.starknetRpcUrl,
		AgentRegistryAddress:   agentRegistryAddress,
		OpenAIKey:              m.openAiKey,
		DstackTappdEndpoint:    m.dstackTappdEndpoint,
	}

	if debug {
		slog.Info("setup output", "output", fmt.Sprintf("%+v\n", output))
	}

	return output, nil
}
