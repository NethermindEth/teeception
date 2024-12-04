package password

import (
	"log/slog"

	"github.com/sethvargo/go-password/password"
)

func GeneratePassword() (string, error) {
	pass, err := password.Generate(16, 4, 4, false, false)
	if err != nil {
		return "", err
	}

	slog.Info("generated password", "password", pass)

	return pass, nil
}
