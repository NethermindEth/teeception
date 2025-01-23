package starknet

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"golang.org/x/time/rate"

	"github.com/NethermindEth/starknet.go/rpc"
)

// ProviderWrapper is a wrapper around a provider.
type ProviderWrapper interface {
	Do(f func(provider rpc.RpcProvider) error) error
}

// RateLimitedMultiProviderConfig is the configuration for the RateLimitedMultiProvider.
type RateLimitedMultiProviderConfig struct {
	Providers []rpc.RpcProvider
	Limiter   *rate.Limiter
}

var _ ProviderWrapper = (*RateLimitedMultiProvider)(nil)

// RateLimitedMultiProvider is a wrapper around multiple providers that limits the number of requests per second.
type RateLimitedMultiProvider struct {
	providers []rpc.RpcProvider
	limiter   *rate.Limiter
}

// NewRateLimitedMultiProvider creates a new RateLimitedMultiProvider.
func NewRateLimitedMultiProvider(config RateLimitedMultiProviderConfig) (*RateLimitedMultiProvider, error) {
	if len(config.Providers) == 0 {
		return nil, errors.New("no providers provided")
	}

	return &RateLimitedMultiProvider{
		providers: config.Providers,
		limiter:   config.Limiter,
	}, nil
}

// Do executes the given function for each provider in the list.
func (p *RateLimitedMultiProvider) Do(f func(provider rpc.RpcProvider) error) error {
	if p.limiter != nil {
		if err := p.limiter.Wait(context.Background()); err != nil {
			return err
		}
	}

	var errs []error

	for idx, provider := range p.providers {
		err := f(provider)
		if err != nil {
			slog.Debug("failed to execute function for provider", "error", err, "provider_index", idx)
			errs = append(errs, err)
		} else {
			slog.Debug("successfully executed function for provider", "provider_index", idx)
			return nil
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to execute function for all providers: %v", errs)
	}

	return nil
}
