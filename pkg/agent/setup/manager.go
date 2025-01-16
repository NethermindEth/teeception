package setup

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"fmt"
	"log/slog"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/NethermindEth/teeception/pkg/agent/encumber/proton"
	"github.com/NethermindEth/teeception/pkg/agent/encumber/twitter"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
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
	TwitterUsername          string     `json:"twitter_username"`
	TwitterPassword          string     `json:"twitter_password"`
	ProtonPassword           string     `json:"proton_password"`
	TwitterConsumerKey       string     `json:"twitter_consumer_key"`
	TwitterConsumerSecret    string     `json:"twitter_consumer_secret"`
	TwitterAuthTokens        string     `json:"twitter_auth_tokens"`
	TwitterAccessToken       string     `json:"twitter_access_token"`
	TwitterAccessTokenSecret string     `json:"twitter_access_token_secret"`
	StarknetPrivateKeySeed   []byte     `json:"starknet_private_key_seed"`
	StarknetRpcUrl           string     `json:"starknet_rpc_url"`
	AgentRegistryAddress     *felt.Felt `json:"agent_registry_address"`
	OpenAIKey                string     `json:"openai_key"`
	DstackTappdEndpoint      string     `json:"dstack_tappd_endpoint"`
	// RSA private key is managed securely through the DStack TEE environment
	// and should not be stored in this structure
}

func NewSetupManagerFromEnv() (*SetupManager, error) {
	setupManager := &SetupManager{
		twitterAccount:       envGetTwitterAccount(),
		twitterPassword:      envGetTwitterPassword(),
		protonEmail:          envGetProtonEmail(),
		protonPassword:       envGetProtonPassword(),
		twitterAppKey:        envGetTwitterAppKey(),
		twitterAppSecret:     envGetTwitterAppSecret(),
		starknetRpcUrl:       envGetStarknetRpcUrl(),
		agentRegistryAddress: envGetAgentRegistryAddress(),
		openAiKey:            envGetOpenAiKey(),
		loginServerIp:        envGetLoginServerIp(),
		loginServerPort:      envGetLoginServerPort(),
		dstackTappdEndpoint:  envGetDstackTappdEndpoint(),
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

	if m.starknetRpcUrl == "" {
		return fmt.Errorf("invalid starknet rpc url")
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

	// dstack endpoint can be empty, so not checking

	return nil
}

func (m *SetupManager) Setup(ctx context.Context) (*SetupOutput, error) {
	agentRegistryAddress, err := starknetgoutils.HexToFelt(m.agentRegistryAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to parse agent registry address: %v", err)
	}

	starknetPrivateKeySeed := snaccount.NewPrivateKey(nil).Bytes()

	protonEncumberer := proton.NewProtonEncumberer(proton.ProtonEncumbererCredentials{
		ProtonUsername: m.protonEmail,
		ProtonPassword: m.protonPassword,
	})

	twitterEncumberer := twitter.NewTwitterEncumberer(twitter.TwitterEncumbererCredentials{
		TwitterUsername:  m.twitterAccount,
		TwitterPassword:  m.twitterPassword,
		TwitterEmail:     m.protonEmail,
		TwitterAppKey:    m.twitterAppKey,
		TwitterAppSecret: m.twitterAppSecret,
	}, m.loginServerIp, m.loginServerPort, func(ctx context.Context) (string, error) {
		return protonEncumberer.GetTwitterVerificationCode(ctx)
	})

	twitterEncumbererOutput, err := twitterEncumberer.Encumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to encumber twitter: %v", err)
	}

	protonEncumbererOutput, err := protonEncumberer.Encumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to encumber proton: %v", err)
	}

	// Generate RSA key pair for system prompt encryption
	rsaPrivateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("failed to generate RSA key pair: %v", err)
	}

	// Convert RSA private key to DER format for storage
	rsaPrivateKeyBytes := x509.MarshalPKCS1PrivateKey(rsaPrivateKey)

	output := &SetupOutput{
		TwitterAuthTokens:        twitterEncumbererOutput.AuthTokens,
		TwitterAccessToken:       twitterEncumbererOutput.OAuthTokenPair.Token,
		TwitterAccessTokenSecret: twitterEncumbererOutput.OAuthTokenPair.TokenSecret,
		TwitterConsumerKey:       m.twitterAppKey,
		TwitterConsumerSecret:    m.twitterAppSecret,
		TwitterUsername:          m.twitterAccount,
		TwitterPassword:          twitterEncumbererOutput.NewPassword,
		ProtonPassword:           protonEncumbererOutput.NewPassword,
		StarknetPrivateKeySeed:   starknetPrivateKeySeed[:],
		StarknetRpcUrl:           m.starknetRpcUrl,
		AgentRegistryAddress:     agentRegistryAddress,
		OpenAIKey:                m.openAiKey,
		DstackTappdEndpoint:      m.dstackTappdEndpoint,
		RsaPrivateKey:           rsaPrivateKeyBytes,
	}

	if debug.IsDebugShowSetup() {
		slog.Info("setup output", "output", fmt.Sprintf("%+v\n", output))
	}

	return output, nil
}
