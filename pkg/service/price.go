package service

import (
	"context"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/teeception/pkg/indexer"
)

type PriceService struct{}

var _ indexer.TokenPriceFeed = (*PriceService)(nil)

func (p *PriceService) GetUsdRate(ctx context.Context, token *felt.Felt) (*big.Int, error) {
	return nil, nil
}
