package starknet

import (
	"fmt"
	"math/big"
	"strings"

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

func bytesFeltToString(f *felt.Felt, length int) string {
	b := f.Bytes()
	return string(b[32-length:])
}

func ByteArrFeltToString(arr []*felt.Felt) (string, error) {
	if len(arr) < 3 {
		return "", fmt.Errorf("invalid felt array, require at least 3 elements in array")
	}

	count := arr[0].Uint64()
	pendingWordLength := arr[len(arr)-1].Uint64()

	var res []string
	if pendingWordLength == 0 {
		res = make([]string, count)
	} else {
		res = make([]string, count+1)
	}

	for index := range count {
		res[index] = bytesFeltToString(arr[1+index], 31)
	}

	if pendingWordLength != 0 {
		res[count] = bytesFeltToString(arr[1+count], int(pendingWordLength))
	}

	return strings.Join(res, ""), nil
}
