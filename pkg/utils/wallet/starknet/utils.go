package starknet

import (
	"log/slog"

	"github.com/NethermindEth/starknet.go/rpc"
)

func LogRpcError(err error) {
	rpcErr, ok := err.(*rpc.RPCError)
	if !ok {
		return
	}

	slog.Error("rpc error", "error", rpcErr, "data", rpcErr.Data, "code", rpcErr.Code, "message", rpcErr.Message)
}
