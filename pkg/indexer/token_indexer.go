package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/teeception/pkg/indexer/price"
)

// TokenPriceUpdate is a struct that contains the token price and its update block
type TokenInfo struct {
	MinPromptPrice *big.Int

	Rate     *big.Int
	RateTime time.Time
}

// TokenIndexer processes token events and tracks token prices.
type TokenIndexer struct {
	tokensMu         sync.RWMutex
	tokens           map[[32]byte]*TokenInfo
	lastIndexedBlock uint64
	rateLimiter      *rate.Limiter
	client           *rpc.Provider
	registryAddress  *felt.Felt
	priceFeed        price.PriceFeed
	priceTickRate    time.Duration
}

// TokenIndexerInitialState is the initial state for a TokenIndexer.
type TokenIndexerInitialState struct {
	Tokens           map[[32]byte]*TokenInfo
	LastIndexedBlock uint64
}

// TokenIndexerConfig is the configuration for a TokenIndexer.
type TokenIndexerConfig struct {
	RateLimiter     *rate.Limiter
	Client          *rpc.Provider
	PriceFeed       price.PriceFeed
	PriceTickRate   time.Duration
	RegistryAddress *felt.Felt
	InitialState    *TokenIndexerInitialState
}

// NewTokenIndexer instantiates a TokenIndexer.
func NewTokenIndexer(cfg *TokenIndexerConfig) *TokenIndexer {
	if cfg.InitialState == nil {
		cfg.InitialState = &TokenIndexerInitialState{
			Tokens:           make(map[[32]byte]*TokenInfo),
			LastIndexedBlock: 0,
		}
	}

	return &TokenIndexer{
		tokens:           cfg.InitialState.Tokens,
		lastIndexedBlock: cfg.InitialState.LastIndexedBlock,
		rateLimiter:      cfg.RateLimiter,
		client:           cfg.Client,
		priceFeed:        cfg.PriceFeed,
		priceTickRate:    cfg.PriceTickRate,
		registryAddress:  cfg.RegistryAddress,
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *TokenIndexer) Run(ctx context.Context, watcher *EventWatcher) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx, watcher)
	})
	g.Go(func() error {
		return i.updatePricesTask(ctx)
	})
	return g.Wait()
}

func (i *TokenIndexer) run(ctx context.Context, watcher *EventWatcher) error {
	ch := make(chan *EventSubscriptionData, 1000)

	// Subscribe to both token added and removed events
	addedSubID := watcher.Subscribe(EventTokenAdded, ch)
	removedSubID := watcher.Subscribe(EventTokenRemoved, ch)

	defer func() {
		watcher.Unsubscribe(addedSubID)
		watcher.Unsubscribe(removedSubID)
	}()

	for {
		select {
		case data := <-ch:
			i.tokensMu.Lock()
			for _, ev := range data.Events {
				switch ev.Type {
				case EventTokenAdded:
					i.onTokenAdded(ev)
				case EventTokenRemoved:
					i.onTokenRemoved(ev)
				}
			}
			i.lastIndexedBlock = data.ToBlock
			i.tokensMu.Unlock()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *TokenIndexer) updatePricesTask(ctx context.Context) error {
	ticker := time.NewTicker(i.priceTickRate)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			i.tokensMu.RLock()
			tokens := make(map[[32]byte]*TokenInfo)
			for token := range i.tokens {
				tokens[token] = i.tokens[token]
			}
			i.tokensMu.RUnlock()

			token := new(felt.Felt)
			for tokenBytes := range tokens {
				if i.rateLimiter != nil {
					if err := i.rateLimiter.Wait(ctx); err != nil {
						return fmt.Errorf("failed to wait for rate limiter: %w", err)
					}
				}

				token.SetBytes(tokenBytes[:])
				price, err := i.priceFeed.GetRate(ctx, token)
				if err != nil {
					slog.Error("failed to get token price", "token", token.String(), "error", err)
					continue
				}
				tokens[tokenBytes].Rate = price
				tokens[tokenBytes].RateTime = time.Now()
			}

			i.tokensMu.Lock()
			i.tokens = tokens
			i.tokensMu.Unlock()

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *TokenIndexer) onTokenAdded(ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("ignoring token added event from non-registry address", "address", ev.Raw.FromAddress.String())
		return
	}

	tokenAddedEv, ok := ev.ToTokenAddedEvent()
	if !ok {
		slog.Error("failed to parse token added event")
		return
	}

	i.tokens[tokenAddedEv.Token.Bytes()] = &TokenInfo{
		MinPromptPrice: tokenAddedEv.MinPromptPrice,
	}
}

func (i *TokenIndexer) onTokenRemoved(ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("ignoring token removed event from non-registry address", "address", ev.Raw.FromAddress.String())
		return
	}

	tokenRemovedEv, ok := ev.ToTokenRemovedEvent()
	if !ok {
		slog.Error("failed to parse token removed event")
		return
	}

	delete(i.tokens, tokenRemovedEv.Token.Bytes())
}

// GetTokenMinPromptPrice returns a token's minimum prompt price, if it exists.
func (i *TokenIndexer) GetTokenMinPromptPrice(token *felt.Felt) (*big.Int, bool) {
	i.tokensMu.RLock()
	defer i.tokensMu.RUnlock()

	tokenInfo, ok := i.tokens[token.Bytes()]
	if !ok {
		return nil, false
	}

	return tokenInfo.MinPromptPrice, true
}

// GetTokenRate returns a token's rate, if it exists.
func (i *TokenIndexer) GetTokenRate(token *felt.Felt) (*big.Int, bool) {
	i.tokensMu.RLock()
	defer i.tokensMu.RUnlock()

	tokenInfo, ok := i.tokens[token.Bytes()]
	if !ok {
		return nil, false
	}

	if tokenInfo.RateTime.IsZero() {
		return nil, false
	}

	return tokenInfo.Rate, true
}

// GetLastIndexedBlock returns the last indexed block.
func (i *TokenIndexer) GetLastIndexedBlock() uint64 {
	i.tokensMu.RLock()
	defer i.tokensMu.RUnlock()

	return i.lastIndexedBlock
}

// ReadState reads the current state of the indexer.
func (i *TokenIndexer) ReadState(f func(map[[32]byte]*TokenInfo, uint64)) {
	i.tokensMu.RLock()
	defer i.tokensMu.RUnlock()

	f(i.tokens, i.lastIndexedBlock)
}
