package starknet

import (
	"context"
	"fmt"
	"log/slog"
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

var classHashFelt, _ = utils.HexToFelt(classHash)

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
		slog.Info("generating random private key")
		_, _, priv := account.GetRandomKeys()
		return priv
	}

	slog.Info("generating private key from seed")
	return curve.Curve.StarknetKeccak(seed)
}

func NewStarknetAccount(privateKey *felt.Felt) (*StarknetAccount, error) {
	slog.Info("creating new starknet account")
	privateKeyBytes := privateKey.Bytes()
	privateKeyBI := new(big.Int).SetBytes(privateKeyBytes[:])
	pubX, _, err := curve.Curve.PrivateToPoint(privateKeyBI)
	if err != nil {
		return nil, fmt.Errorf("failed to generate public key: %w", err)
	}
	pubFelt := utils.BigIntToFelt(pubX)

	ks := account.NewMemKeystore()
	privKeyBI, ok := new(big.Int).SetString(privateKey.String(), 0)
	if !ok {
		return nil, fmt.Errorf("failed to setup account key store: invalid private key string")
	}
	ks.Put(pubFelt.String(), privKeyBI)

	slog.Info("starknet account created", "public_key", pubFelt.String())
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

func (a *StarknetAccount) PublicKey() *felt.Felt {
	return a.options.PublicKey
}

func (a *StarknetAccount) Account() (*account.Account, error) {
	if !a.deployed {
		return nil, fmt.Errorf("account not deployed")
	}

	return a.account, nil
}

func (a *StarknetAccount) connect(client ProviderWrapper) error {
	if a.account != nil {
		return nil
	}

	var err error

	slog.Info("creating new account instance")
	err = client.Do(func(provider rpc.RpcProvider) error {
		a.account, err = account.NewAccount(provider, a.options.PublicKey, a.options.PublicKey.String(), a.options.Keystore, cairoVersion)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to create new account instance: %w", err)
	}

	classHashFelt, err := utils.HexToFelt(classHash)
	if err != nil {
		return fmt.Errorf("failed to convert class hash to felt: %w", err)
	}

	slog.Info("precomputing account address")
	a.address, err = a.account.PrecomputeAccountAddress(a.options.PublicKey, classHashFelt, []*felt.Felt{a.options.PublicKey})
	if err != nil {
		return fmt.Errorf("failed to precompute account address: %w", FormatRpcError(err))
	}
	slog.Info("account address computed", "address", a.address.String())

	return nil
}

func (a *StarknetAccount) Connect(client ProviderWrapper) error {
	a.connectMu.Lock()
	defer a.connectMu.Unlock()

	if a.connected {
		slog.Info("account already connected")
		return nil
	}

	slog.Info("connecting account")
	if err := a.connect(client); err != nil {
		return fmt.Errorf("failed to connect account: %w", err)
	}

	a.connected = true

	return nil
}

func (a *StarknetAccount) classHashMatches(ctx context.Context) (bool, error) {
	slog.Info("checking current class hash")
	currentClassHash, err := a.account.ClassHashAt(ctx, rpc.WithBlockTag("pending"), a.address)
	if err != nil {
		if err.Error() != "Contract not found" {
			return false, fmt.Errorf("failed to get current class hash: %w", FormatRpcError(err))
		} else {
			currentClassHash = new(felt.Felt).SetUint64(0)
		}
	}

	if currentClassHash.Cmp(classHashFelt) == 0 {
		slog.Info("account already deployed with correct class hash")
		return true, nil
	}

	return false, nil
}

func (a *StarknetAccount) deploy(ctx context.Context, client ProviderWrapper) error {
	if !a.connected {
		slog.Info("connecting account before deployment")
		err := a.Connect(client)
		if err != nil {
			return fmt.Errorf("failed to connect account before deployment: %w", err)
		}
	}

	classHashMatches, err := a.classHashMatches(ctx)
	if err != nil {
		return fmt.Errorf("failed to check class hash: %w", err)
	}

	if classHashMatches {
		return nil
	}

	slog.Info("preparing deploy account transaction")
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

	slog.Info("signing deploy account transaction")
	err = a.account.SignDeployAccountTransaction(ctx, &tx.DeployAccountTxn, a.address)
	if err != nil {
		return fmt.Errorf("failed to sign deploy account transaction: %w", FormatRpcError(err))
	}

	slog.Info("estimating transaction fee")
	feeRes, err := a.account.EstimateFee(ctx, []rpc.BroadcastTxn{tx}, []rpc.SimulationFlag{}, rpc.WithBlockTag("pending"))
	if err != nil {
		return fmt.Errorf("failed to estimate transaction fee: %w", FormatRpcError(err))
	}

	fee := feeRes[0].OverallFee
	feeBI := fee.BigInt(new(big.Int))

	feeBI.Add(feeBI, new(big.Int).Div(feeBI, big.NewInt(5)))
	tx.DeployAccountTxn.MaxFee = new(felt.Felt).SetBigInt(feeBI)

	slog.Info("estimated fee", "fee", fee.String())

	slog.Info("signing final deploy account transaction")
	err = a.account.SignDeployAccountTransaction(ctx, &tx.DeployAccountTxn, a.address)
	if err != nil {
		return fmt.Errorf("failed to sign final deploy account transaction: %w", FormatRpcError(err))
	}

	slog.Info("broadcasting deploy account transaction")
	resp, err := a.account.AddDeployAccountTransaction(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to broadcast deploy account transaction: %w", FormatRpcError(err))
	}

	if resp.ContractAddress.Cmp(a.address) != 0 {
		return fmt.Errorf("contract address mismatch: expected %s, got %s", a.address.String(), resp.ContractAddress.String())
	}

	slog.Info("account deployed successfully", "address", a.address.String())
	return nil
}

func (a *StarknetAccount) Deploy(ctx context.Context, client ProviderWrapper) error {
	a.deployMu.Lock()
	defer a.deployMu.Unlock()

	if a.deployed {
		slog.Info("account already deployed")
		return nil
	}

	slog.Info("deploying account")
	if err := a.deploy(ctx, client); err != nil {
		return fmt.Errorf("failed to deploy account: %w", err)
	}

	a.deployed = true

	return nil
}

func (a *StarknetAccount) LoadDeployment(ctx context.Context, client ProviderWrapper) (bool, error) {
	a.deployMu.Lock()
	defer a.deployMu.Unlock()

	classHashMatches, err := a.classHashMatches(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to check class hash: %w", err)
	}

	if classHashMatches {
		a.deployed = true
	}

	return classHashMatches, nil
}
