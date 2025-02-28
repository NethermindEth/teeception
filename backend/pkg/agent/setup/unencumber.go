package setup

import (
	"fmt"
)

type UnencumberData struct {
	EncryptedTwitterPassword []byte
	EncryptedEmailPassword   []byte
}

func NewUnencumberDataFromSetupOutput(setupOutput *SetupOutput) (*UnencumberData, error) {
	encryptionKey := setupOutput.UnencumberEncryptionKey

	encryptedTwitterPassword, err := encrypt([]byte(setupOutput.TwitterPassword), encryptionKey[:])
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt twitter password: %v", err)
	}

	encryptedEmailPassword, err := encrypt([]byte(setupOutput.ProtonPassword), encryptionKey[:])
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt email password: %v", err)
	}

	return &UnencumberData{
		EncryptedTwitterPassword: encryptedTwitterPassword,
		EncryptedEmailPassword:   encryptedEmailPassword,
	}, nil
}
