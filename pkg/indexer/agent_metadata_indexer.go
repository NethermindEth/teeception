package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

// AgentMetadata holds the expanded data for an agent.
type AgentMetadata struct {
	PromptPrice *felt.Felt
	Token       *felt.Felt
	Initialized bool
}

// AgentMetadataIndexer fetches and caches each agent's extra data.
type AgentMetadataIndexer struct {
	client *rpc.Provider

	mu               sync.RWMutex
	metadata         map[[32]byte]AgentMetadata
	lastIndexedBlock uint64

	registryAddress *felt.Felt
	rateLimiter     *rate.Limiter

	initQueue chan *felt.Felt
}

// AgentMetadataIndexerInitialState is the initial state for an AgentMetadataIndexer.
type AgentMetadataIndexerInitialState struct {
	Metadata         map[[32]byte]AgentMetadata
	LastIndexedBlock uint64
}

// AgentMetadataIndexerConfig is the configuration for an AgentMetadataIndexer.
type AgentMetadataIndexerConfig struct {
	Client          *rpc.Provider
	RegistryAddress *felt.Felt
	RateLimiter     *rate.Limiter
	InitialState    *AgentMetadataIndexerInitialState
}

// NewAgentMetadataIndexer creates a new instance.
func NewAgentMetadataIndexer(config *AgentMetadataIndexerConfig) *AgentMetadataIndexer {
	if config.InitialState == nil {
		config.InitialState = &AgentMetadataIndexerInitialState{
			Metadata:         make(map[[32]byte]AgentMetadata),
			LastIndexedBlock: 0,
		}
	}

	return &AgentMetadataIndexer{
		client:           config.Client,
		metadata:         config.InitialState.Metadata,
		lastIndexedBlock: config.InitialState.LastIndexedBlock,
		registryAddress:  config.RegistryAddress,
		rateLimiter:      config.RateLimiter,
		initQueue:        make(chan *felt.Felt, 1000),
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *AgentMetadataIndexer) Run(ctx context.Context, watcher *EventWatcher) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx, watcher)
	})
	g.Go(func() error {
		return i.runInitializer(ctx)
	})
	return g.Wait()
}

func (i *AgentMetadataIndexer) run(ctx context.Context, watcher *EventWatcher) error {
	ch := make(chan *EventSubscriptionData, 1000)
	subID := watcher.Subscribe(EventAgentRegistered, ch)
	defer watcher.Unsubscribe(subID)

	for {
		select {
		case data := <-ch:
			i.mu.Lock()
			for _, ev := range data.Events {
				i.onAgentRegistered(ctx, ev)
			}
			i.lastIndexedBlock = data.ToBlock
			i.mu.Unlock()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *AgentMetadataIndexer) runInitializer(ctx context.Context) error {
	for {
		select {
		case addr := <-i.initQueue:
			if _, err := i.initializeMetadata(ctx, addr); err != nil {
				slog.Error("failed to initialize metadata", "error", err)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *AgentMetadataIndexer) onAgentRegistered(ctx context.Context, ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("received agent registered event from non-registry address", "address", ev.Raw.FromAddress)
		return
	}

	agentRegisteredEv, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		slog.Error("failed to parse agent registered event")
		return
	}

	select {
	case i.initQueue <- agentRegisteredEv.Agent:
	default:
		slog.Error("initialization queue full, dropping agent", "agent", agentRegisteredEv.Agent)
	}
}

// initializeMetadata checks if we've fetched this agent's metadata; if not, fetches it.
func (i *AgentMetadataIndexer) initializeMetadata(ctx context.Context, addr *felt.Felt) (AgentMetadata, error) {
	addrBytes := addr.Bytes()

	i.mu.RLock()
	existing, ok := i.metadata[addrBytes]
	i.mu.RUnlock()
	if ok && existing.Initialized {
		return existing, nil
	}

	fetched, err := i.fetchMetadata(ctx, addr)
	if err != nil {
		return AgentMetadata{}, fmt.Errorf("failed to fetch metadata: %v", err)
	}

	i.mu.Lock()
	i.metadata[addrBytes] = fetched
	i.mu.Unlock()

	return fetched, nil
}

func (i *AgentMetadataIndexer) fetchMetadata(ctx context.Context, addr *felt.Felt) (AgentMetadata, error) {
	if i.rateLimiter != nil {
		if err := i.rateLimiter.Wait(ctx); err != nil {
			return AgentMetadata{}, fmt.Errorf("rate limit exceeded: %v", err)
		}
	}

	if i.rateLimiter != nil {
		if err := i.rateLimiter.Wait(ctx); err != nil {
			return AgentMetadata{}, fmt.Errorf("rate limit exceeded: %v", err)
		}
	}
	priceResp, err := i.client.Call(ctx, rpc.FunctionCall{
		ContractAddress:    addr,
		EntryPointSelector: getPromptPriceSelector,
	}, rpc.WithBlockTag("latest"))
	if err != nil {
		return AgentMetadata{}, fmt.Errorf("get_prompt_price call failed: %v", snaccount.FormatRpcError(err))
	}
	if len(priceResp) < 1 {
		return AgentMetadata{}, fmt.Errorf("get_prompt_price unexpected length")
	}

	if i.rateLimiter != nil {
		if err := i.rateLimiter.Wait(ctx); err != nil {
			return AgentMetadata{}, fmt.Errorf("rate limit exceeded: %v", err)
		}
	}
	tokenResp, err := i.client.Call(ctx, rpc.FunctionCall{
		ContractAddress:    addr,
		EntryPointSelector: getTokenSelector,
	}, rpc.WithBlockTag("latest"))
	if err != nil {
		return AgentMetadata{}, fmt.Errorf("get_token call failed: %v", snaccount.FormatRpcError(err))
	}
	if len(tokenResp) < 1 {
		return AgentMetadata{}, fmt.Errorf("get_token unexpected length")
	}

	meta := AgentMetadata{
		PromptPrice: priceResp[0],
		Token:       tokenResp[0],
		Initialized: true,
	}
	return meta, nil
}

// GetMetadata returns any known cached data for an agent. If empty, it may not be fully fetched.
func (i *AgentMetadataIndexer) GetMetadata(addr *felt.Felt) (AgentMetadata, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	val, ok := i.metadata[addr.Bytes()]
	return val, ok
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentMetadataIndexer) GetLastIndexedBlock() uint64 {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.lastIndexedBlock
}

// ReadState reads the current state of the indexer.
func (i *AgentMetadataIndexer) ReadState(f func(map[[32]byte]AgentMetadata, uint64)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.metadata, i.lastIndexedBlock)
}
