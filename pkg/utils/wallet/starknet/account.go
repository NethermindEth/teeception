package starknet

import (
	"context"
	"fmt"
	"math/big"
	"sync"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/account"
	"github.com/NethermindEth/starknet.go/curve"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/starknet.go/utils"
)

const (
	cairoVersion = 2
	classHash    = "0x61dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f"
)

type StarknetAccountOptions struct {
	PublicKey  *felt.Felt
	PrivateKey *felt.Felt
	Keystore   account.Keystore
}

type StarknetAccount struct {
	connectMu sync.Mutex
	connected bool

	deployMu sync.Mutex
	deployed bool

	account *account.Account
	address *felt.Felt

	options StarknetAccountOptions
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
		options: StarknetAccountOptions{
			PublicKey:  pubFelt,
			PrivateKey: privateKey,
			Keystore:   ks,
		},
	}, nil
}

func (a *StarknetAccount) Address() *felt.Felt {
	return a.address
}

func (a *StarknetAccount) Account() (*account.Account, error) {
	if !a.deployed {
		return nil, fmt.Errorf("account not deployed")
	}

	return a.account, nil
}

func (a *StarknetAccount) connect(provider rpc.RpcProvider) error {
	if a.account != nil {
		return nil
	}

	var err error

	a.account, err = account.NewAccount(provider, a.options.PublicKey, a.options.PublicKey.String(), a.options.Keystore, cairoVersion)
	if err != nil {
		return err
	}

	classHashFelt, err := utils.HexToFelt(classHash)
	if err != nil {
		return err
	}

	a.address, err = a.account.PrecomputeAccountAddress(a.options.PublicKey, classHashFelt, []*felt.Felt{a.options.PublicKey})
	if err != nil {
		return err
	}

	return nil
}

func (a *StarknetAccount) Connect(provider rpc.RpcProvider) error {
	a.connectMu.Lock()
	defer a.connectMu.Unlock()

	if a.connected {
		return nil
	}

	return a.connect(provider)
}

func (a *StarknetAccount) deploy(ctx context.Context, provider rpc.RpcProvider) error {
	if !a.connected {
		err := a.Connect(provider)
		if err != nil {
			return err
		}
	}

	classHashFelt, err := utils.HexToFelt(classHash)
	if err != nil {
		return err
	}

	currentClassHash, err := a.account.ClassHashAt(ctx, rpc.WithBlockTag("latest"), a.address)
	if err != nil {
		return err
	}

	if currentClassHash.Cmp(classHashFelt) == 0 {
		return nil
	}

	tx := rpc.BroadcastDeployAccountTxn{
		DeployAccountTxn: rpc.DeployAccountTxn{
			Nonce:               &felt.Zero,
			MaxFee:              new(felt.Felt).SetUint64(7268996239700),
			Type:                rpc.TransactionType_DeployAccount,
			Version:             rpc.TransactionV1,
			Signature:           []*felt.Felt{},
			ClassHash:           classHashFelt,
			ContractAddressSalt: a.options.PublicKey,
			ConstructorCalldata: []*felt.Felt{a.options.PublicKey},
		},
	}

	err = a.account.SignDeployAccountTransaction(ctx, &tx.DeployAccountTxn, a.address)
	if err != nil {
		return err
	}

	feeRes, err := a.account.EstimateFee(ctx, []rpc.BroadcastTxn{tx}, []rpc.SimulationFlag{}, rpc.WithBlockTag("latest"))
	if err != nil {
		return err
	}

	fee := feeRes[0].OverallFee
	tx.DeployAccountTxn.MaxFee = fee.Add(fee, fee.Div(fee, new(felt.Felt).SetUint64(5)))

	err = a.account.SignDeployAccountTransaction(ctx, &tx.DeployAccountTxn, a.address)
	if err != nil {
		return err
	}

	resp, err := a.account.AddDeployAccountTransaction(ctx, tx)
	if err != nil {
		return err
	}

	if resp.ContractAddress.Cmp(a.address) != 0 {
		return fmt.Errorf("contract address mismatch")
	}

	return nil
}

func (a *StarknetAccount) Deploy(ctx context.Context, provider rpc.RpcProvider) error {
	a.deployMu.Lock()
	defer a.deployMu.Unlock()

	if a.deployed {
		return nil
	}

	return a.deploy(ctx, provider)
}
