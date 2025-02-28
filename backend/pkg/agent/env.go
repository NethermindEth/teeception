package agent

import (
	"fmt"
	"log/slog"
	"os"
)

const (
	XClientModeKey            = "X_CLIENT_MODE"
	AgentTwitterClientPortKey = "AGENT_TWITTER_CLIENT_PORT"
)

func envGetAgentTwitterClientMode() string {
	mode, ok := os.LookupEnv(XClientModeKey)
	if !ok {
		slog.Warn(XClientModeKey + " environment variable not set")
	}
	return mode
}

func envLookupAgentTwitterClientPort() (string, error) {
	port, ok := os.LookupEnv(AgentTwitterClientPortKey)
	if !ok {
		return "", fmt.Errorf(AgentTwitterClientPortKey + " environment variable not set")
	}
	return port, nil
}
