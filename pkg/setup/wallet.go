package setup

import (
	"crypto/ecdsa"

	"github.com/defiweb/go-eth/wallet"
)

func GeneratePrivateKey() *ecdsa.PrivateKey {
	return wallet.NewRandomKey().PrivateKey()
}
