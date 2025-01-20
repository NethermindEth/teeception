package price

import (
	"context"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
)

type PriceFeed interface {
	GetRate(ctx context.Context, token *felt.Felt) (*big.Int, error)
}
