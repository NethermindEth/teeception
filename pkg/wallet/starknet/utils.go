package starknet

import (
	"fmt"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
)

type StandardRpcFormattedError struct {
	Err error
}

var _ error = (*StandardRpcFormattedError)(nil)

func (e *StandardRpcFormattedError) Error() string {
	rpcErr, ok := e.Err.(*rpc.RPCError)
	if !ok {
		return fmt.Sprintf("non-rpc error: %w", e.Err)
	}
	return fmt.Sprintf("rpc error: (%d, %s, %v)", rpcErr.Code, rpcErr.Message, rpcErr.Data)
}

func FormatRpcError(err error) error {
	return &StandardRpcFormattedError{Err: err}
}

func Uint256ToBigInt(uint256 [2]*felt.Felt) *big.Int {
	amountLow := uint256[0].BigInt(new(big.Int))
	amountHigh := uint256[1].BigInt(new(big.Int))
	return amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
}
