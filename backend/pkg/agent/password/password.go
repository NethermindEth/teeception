package password

import (
	"github.com/sethvargo/go-password/password"
)

func GeneratePassword() (string, error) {
	pass, err := password.Generate(16, 4, 4, false, false)
	if err != nil {
		return "", err
	}

	return pass, nil
}
