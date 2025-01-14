package setup

import (
	"fmt"
	"log/slog"
	"os"
)

const (
	SecureFileKey           = "SECURE_FILE"
	DstackTappdEndpointKey  = "DSTACK_TAPPD_ENDPOINT"
	TwitterAccountKey       = "X_USERNAME"
	TwitterPasswordKey      = "X_PASSWORD"
	TwitterAppKeyKey        = "X_CONSUMER_KEY"
	TwitterAppSecretKey     = "X_CONSUMER_SECRET"
	LoginServerIpKey        = "X_LOGIN_SERVER_IP"
	LoginServerPortKey      = "X_LOGIN_SERVER_PORT"
	ProtonEmailKey          = "PROTONMAIL_EMAIL"
	ProtonPasswordKey       = "PROTONMAIL_PASSWORD"
	StarknetRpcUrlKey       = "STARKNET_RPC_URL"
	AgentRegistryAddressKey = "CONTRACT_ADDRESS"
	OpenAiKeyKey            = "OPENAI_API_KEY"
)

func envLookupSecureFile() (string, error) {
	secureFilePath, ok := os.LookupEnv(SecureFileKey)
	if !ok {
		return "", fmt.Errorf(SecureFileKey + " environment variable not set")
	}
	return secureFilePath, nil
}

func envGetDstackTappdEndpoint() string {
	dstackTappdEndpoint, ok := os.LookupEnv(DstackTappdEndpointKey)
	if !ok {
		slog.Warn(DstackTappdEndpointKey + " environment variable not set")
	}
	return dstackTappdEndpoint
}

func envGetTwitterAccount() string {
	account, ok := os.LookupEnv(TwitterAccountKey)
	if !ok {
		slog.Warn(TwitterAccountKey + " environment variable not set")
	}
	return account
}

func envGetTwitterPassword() string {
	password, ok := os.LookupEnv(TwitterPasswordKey)
	if !ok {
		slog.Warn(TwitterPasswordKey + " environment variable not set")
	}
	return password
}

func envGetTwitterAppKey() string {
	appKey, ok := os.LookupEnv(TwitterAppKeyKey)
	if !ok {
		slog.Warn(TwitterAppKeyKey + " environment variable not set")
	}
	return appKey
}

func envGetTwitterAppSecret() string {
	appSecret, ok := os.LookupEnv(TwitterAppSecretKey)
	if !ok {
		slog.Warn(TwitterAppSecretKey + " environment variable not set")
	}
	return appSecret
}

func envGetLoginServerIp() string {
	ip, ok := os.LookupEnv(LoginServerIpKey)
	if !ok {
		slog.Warn(LoginServerIpKey + " environment variable not set")
	}
	return ip
}

func envGetLoginServerPort() string {
	port, ok := os.LookupEnv(LoginServerPortKey)
	if !ok {
		slog.Warn(LoginServerPortKey + " environment variable not set")
	}
	return port
}

func envGetProtonEmail() string {
	email, ok := os.LookupEnv(ProtonEmailKey)
	if !ok {
		slog.Warn(ProtonEmailKey + " environment variable not set")
	}
	return email
}

func envGetProtonPassword() string {
	password, ok := os.LookupEnv(ProtonPasswordKey)
	if !ok {
		slog.Warn(ProtonPasswordKey + " environment variable not set")
	}
	return password
}

func envGetStarknetRpcUrl() string {
	url, ok := os.LookupEnv(StarknetRpcUrlKey)
	if !ok {
		slog.Warn(StarknetRpcUrlKey + " environment variable not set")
	}
	return url
}

func envGetAgentRegistryAddress() string {
	address, ok := os.LookupEnv(AgentRegistryAddressKey)
	if !ok {
		slog.Warn(AgentRegistryAddressKey + " environment variable not set")
	}
	return address
}

func envGetOpenAiKey() string {
	key, ok := os.LookupEnv(OpenAiKeyKey)
	if !ok {
		slog.Warn(OpenAiKeyKey + " environment variable not set")
	}
	return key
}
