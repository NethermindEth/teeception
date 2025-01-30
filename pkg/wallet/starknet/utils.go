package starknet

import (
	"fmt"
	"log/slog"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
)

func LogRpcError(err error) {
	rpcErr, ok := err.(*rpc.RPCError)
	if !ok {
		return
	}

	slog.Error("rpc error", "error", rpcErr, "data", rpcErr.Data, "code", rpcErr.Code, "message", rpcErr.Message)
}

func FormatRpcError(err error) string {
	rpcErr, ok := err.(*rpc.RPCError)
	if !ok {
		return fmt.Sprintf("non-rpc error: %v", err)
	}
	return fmt.Sprintf("rpc error: (%d, %s, %v)", rpcErr.Code, rpcErr.Message, rpcErr.Data)
}

func Uint256ToBigInt(uint256 [2]*felt.Felt) *big.Int {
	amountLow := uint256[0].BigInt(new(big.Int))
	amountHigh := uint256[1].BigInt(new(big.Int))
	return amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
}
