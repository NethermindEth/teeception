package price

import (
	"context"
	"fmt"
	"math/big"

	"github.com/NethermindEth/juno/core/felt"
)

type StaticPriceFeed struct {
	rates map[[32]byte]*big.Int
}

var _ PriceFeed = (*StaticPriceFeed)(nil)

func NewStaticPriceFeed(rates map[[32]byte]*big.Int) *StaticPriceFeed {
	return &StaticPriceFeed{rates: rates}
}

func (p *StaticPriceFeed) GetRate(_ context.Context, token *felt.Felt) (*big.Int, error) {
	rate, ok := p.rates[token.Bytes()]
	if !ok {
		return nil, fmt.Errorf("token not found: %s", token.String())
	}
	return rate, nil
}
