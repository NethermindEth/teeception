package starknet

import (
	"fmt"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/account"
	"github.com/NethermindEth/starknet.go/curve"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/starknet.go/utils"
)

const (
	cairoVersion = 2
	classHash    = "0x0000000000000000000000000000000000000000000000000000000000000000"
)

type StarknetAccount struct {
	address    *felt.Felt
	publicKey  *felt.Felt
	privateKey *felt.Felt
	keystore   account.Keystore
}

func NewPrivateKey(seed []byte) *felt.Felt {
	if seed == nil {
		_, _, priv := account.GetRandomKeys()
		return priv
	}

	return curve.Curve.StarknetKeccak(seed)
}

func NewStarknetAccount(privateKey *felt.Felt) (*StarknetAccount, error) {
	privateKeyBytes := privateKey.Bytes()
	privateKeyBI := new(big.Int).SetBytes(privateKeyBytes[:])
	pubX, _, err := curve.Curve.PrivateToPoint(privateKeyBI)
	if err != nil {
		return nil, fmt.Errorf("can't generate public key: %w", err)
	}
	pubFelt := utils.BigIntToFelt(pubX)

	ks := account.NewMemKeystore()
	privKeyBI, ok := new(big.Int).SetString(privateKey.String(), 0)
	if !ok {
		return nil, fmt.Errorf("error setting up account key store")
	}
	ks.Put(pubFelt.String(), privKeyBI)

	return &StarknetAccount{
		address:    pubFelt,
		publicKey:  pubFelt,
		privateKey: privateKey,
		keystore:   ks,
	}, nil
}

func (a *StarknetAccount) Connect(provider rpc.RpcProvider) (*account.Account, error) {
	return account.NewAccount(provider, a.address, a.publicKey.String(), a.keystore, cairoVersion)
}
