package setup

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/NethermindEth/juno/core/felt"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/NethermindEth/teeception/backend/pkg/agent/debug"
	snaccount "github.com/NethermindEth/teeception/backend/pkg/wallet/starknet"
	"github.com/dghubble/oauth1"
)

type SetupManager struct {
	twitterAccount               string
	twitterPassword              string
	protonEmail                  string
	protonPassword               string
	twitterAppKey                string
	twitterAppSecret             string
	starknetRpcUrls              []string
	agentRegistryAddress         string
	agentRegistryDeploymentBlock uint64
	openAiKey                    string
	loginServerIp                string
	loginServerPort              string
	dstackTappdEndpoint          string
	unencumberEncryptionKey      [32]byte
}

type SetupOutput struct {
	TwitterUsername              string     `json:"twitter_username"`
	TwitterPassword              string     `json:"twitter_password"`
	ProtonEmail                  string     `json:"proton_email"`
	ProtonPassword               string     `json:"proton_password"`
	TwitterConsumerKey           string     `json:"twitter_consumer_key"`
	TwitterConsumerSecret        string     `json:"twitter_consumer_secret"`
	TwitterAuthTokens            string     `json:"twitter_auth_tokens"`
	TwitterAccessToken           string     `json:"twitter_access_token"`
	TwitterAccessTokenSecret     string     `json:"twitter_access_token_secret"`
	StarknetPrivateKeySeed       []byte     `json:"starknet_private_key_seed"`
	StarknetRpcUrls              []string   `json:"starknet_rpc_urls"`
	AgentRegistryAddress         *felt.Felt `json:"agent_registry_address"`
	AgentRegistryDeploymentBlock uint64     `json:"agent_registry_deployment_block"`
	OpenAIKey                    string     `json:"openai_key"`
	DstackTappdEndpoint          string     `json:"dstack_tappd_endpoint"`
	UnencumberEncryptionKey      [32]byte   `json:"encryption_key"`
}

func NewSetupManagerFromEnv() (*SetupManager, error) {
	setupManager := &SetupManager{
		twitterAccount:               envGetTwitterAccount(),
		twitterPassword:              envGetTwitterPassword(),
		protonEmail:                  envGetProtonEmail(),
		protonPassword:               envGetProtonPassword(),
		twitterAppKey:                envGetTwitterAppKey(),
		twitterAppSecret:             envGetTwitterAppSecret(),
		starknetRpcUrls:              envGetStarknetRpcUrls(),
		agentRegistryAddress:         envGetAgentRegistryAddress(),
		agentRegistryDeploymentBlock: envGetAgentRegistryDeploymentBlock(),
		openAiKey:                    envGetOpenAiKey(),
		loginServerIp:                envGetLoginServerIp(),
		loginServerPort:              envGetLoginServerPort(),
		dstackTappdEndpoint:          envGetDstackTappdEndpoint(),
		unencumberEncryptionKey:      envGetUnencumberEncryptionKey(),
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

	if len(m.starknetRpcUrls) == 0 {
		return fmt.Errorf("invalid starknet rpc urls")
	}

	if m.agentRegistryAddress == "" {
		return fmt.Errorf("invalid agent registry address")
	}

	if m.openAiKey == "" {
		return fmt.Errorf("invalid openai key")
	}

	if m.loginServerIp == "" || m.loginServerPort == "" {
		return fmt.Errorf("invalid login server credentials")
	}

	if len(m.unencumberEncryptionKey) != 32 {
		return fmt.Errorf("invalid encryption key")
	}

	// dstack endpoint can be empty, so not checking

	return nil
}

func (m *SetupManager) Setup(ctx context.Context) (*SetupOutput, error) {
	agentRegistryAddress, err := starknetgoutils.HexToFelt(m.agentRegistryAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to parse agent registry address: %v", err)
	}

	starknetPrivateKeySeed := snaccount.NewPrivateKey(nil).Bytes()

	var authTokens string
	var oauthTokenPair *oauth1.Token
	var twitterPassword string
	var protonPassword string

	if !envGetDisableEncumbering() {
		return nil, fmt.Errorf("encumbering currently disabled")

		// protonEncumberer := proton.NewProtonEncumberer(proton.ProtonEncumbererCredentials{
		// 	ProtonUsername: m.protonEmail,
		// 	ProtonPassword: m.protonPassword,
		// })

		// twitterEncumberer := twitter.NewTwitterEncumberer(twitter.TwitterEncumbererCredentials{
		// 	TwitterUsername:  m.twitterAccount,
		// 	TwitterPassword:  m.twitterPassword,
		// 	TwitterEmail:     m.protonEmail,
		// 	TwitterAppKey:    m.twitterAppKey,
		// 	TwitterAppSecret: m.twitterAppSecret,
		// }, m.loginServerIp, m.loginServerPort, func(ctx context.Context) (string, error) {
		// 	return protonEncumberer.GetTwitterVerificationCode(ctx)
		// })

		// twitterEncumbererOutput, err := twitterEncumberer.Encumber(ctx)
		// if err != nil {
		// 	return nil, fmt.Errorf("failed to encumber twitter: %v", err)
		// }

		// protonEncumbererOutput, err := protonEncumberer.Encumber(ctx)
		// if err != nil {
		// 	return nil, fmt.Errorf("failed to encumber proton: %v", err)
		// }

		// authTokens = twitterEncumbererOutput.AuthTokens
		// oauthTokenPair = twitterEncumbererOutput.OAuthTokenPair
		// twitterPassword = twitterEncumbererOutput.NewPassword
		// protonPassword = protonEncumbererOutput.NewPassword
	} else {
		twitterPassword = m.twitterPassword
		protonPassword = m.protonPassword
		oauthTokenPair = &oauth1.Token{
			Token:       "",
			TokenSecret: "",
		}
		authTokens = ""
	}

	output := &SetupOutput{
		TwitterAuthTokens:            authTokens,
		TwitterAccessToken:           oauthTokenPair.Token,
		TwitterAccessTokenSecret:     oauthTokenPair.TokenSecret,
		TwitterConsumerKey:           m.twitterAppKey,
		TwitterConsumerSecret:        m.twitterAppSecret,
		TwitterUsername:              m.twitterAccount,
		TwitterPassword:              twitterPassword,
		ProtonEmail:                  m.protonEmail,
		ProtonPassword:               protonPassword,
		StarknetPrivateKeySeed:       starknetPrivateKeySeed[:],
		StarknetRpcUrls:              m.starknetRpcUrls,
		AgentRegistryAddress:         agentRegistryAddress,
		AgentRegistryDeploymentBlock: m.agentRegistryDeploymentBlock,
		OpenAIKey:                    m.openAiKey,
		DstackTappdEndpoint:          m.dstackTappdEndpoint,
		UnencumberEncryptionKey:      m.unencumberEncryptionKey,
	}

	if debug.IsDebugShowSetup() {
		slog.Info("setup output", "output", fmt.Sprintf("%+v\n", output))
	}

	return output, nil
}
