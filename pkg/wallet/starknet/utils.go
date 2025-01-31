package starknet

import (
	"fmt"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
)

type RpcFormattedError struct {
	rpcErr *rpc.RPCError
}

var _ error = (*RpcFormattedError)(nil)

func (e *RpcFormattedError) Error() string {
	return fmt.Sprintf("rpc error: (%d, %s, %v)", e.rpcErr.Code, e.rpcErr.Message, e.rpcErr.Data)
}

func FormatRpcError(err error) error {
	rpcErr, ok := err.(*rpc.RPCError)
	if !ok {
		return fmt.Errorf("non-rpc error: %w", err)
	}
	return &RpcFormattedError{rpcErr: rpcErr}
}

func Uint256ToBigInt(uint256 [2]*felt.Felt) *big.Int {
	amountLow := uint256[0].BigInt(new(big.Int))
	amountHigh := uint256[1].BigInt(new(big.Int))
	return amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
}
