package debug

import "os"

const (
	DebugPlainSetupKey     = "DEBUG_PLAIN_SETUP"
	DebugShowSetupKey      = "DEBUG_SHOW_SETUP"
	DebugShowPasswordKey   = "DEBUG_SHOW_PASSWORD"
	DebugDisableRepliesKey = "DEBUG_DISABLE_REPLIES"
)

func isDebugPlainSetupSet() bool {
	return os.Getenv(DebugPlainSetupKey) == "true"
}

func isDebugShowSetupSet() bool {
	return os.Getenv(DebugShowSetupKey) == "true"
}

func isDebugShowPasswordSet() bool {
	return os.Getenv(DebugShowPasswordKey) == "true"
}

func isDebugDisableRepliesSet() bool {
	return os.Getenv(DebugDisableRepliesKey) == "true"
}
