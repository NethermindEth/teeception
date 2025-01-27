package debug

const (
	Debug = true
)

func IsDebug() bool {
	return Debug
}

func IsDebugPlainSetup() bool {
	return Debug && isDebugPlainSetupSet()
}

func IsDebugShowSetup() bool {
	return Debug && isDebugShowSetupSet()
}

func IsDebugShowPassword() bool {
	return Debug && isDebugShowPasswordSet()
}

func IsDebugDisableReplies() bool {
	return Debug && isDebugDisableRepliesSet()
}

func IsDebugDisableTweetValidation() bool {
	return Debug && isDebugDisableTweetValidationSet()
}
