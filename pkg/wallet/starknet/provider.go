package starknet

import (
	"context"

	"golang.org/x/time/rate"

	"github.com/NethermindEth/starknet.go/rpc"
)

type RateLimitedProvider struct {
	provider *rpc.Provider
	limiter  *rate.Limiter
}

func NewRateLimitedProvider(provider *rpc.Provider, limiter *rate.Limiter) *RateLimitedProvider {
	return &RateLimitedProvider{provider: provider, limiter: limiter}
}

func NewRateLimitedProviderWithNoLimiter(provider *rpc.Provider) *RateLimitedProvider {
	return &RateLimitedProvider{provider: provider, limiter: nil}
}

func (p *RateLimitedProvider) Do(f func(provider *rpc.Provider) error) error {
	if err := p.limiter.Wait(context.Background()); err != nil {
		return err
	}

	return f(p.provider)
}
