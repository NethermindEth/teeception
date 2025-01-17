package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentBalance struct {
	Balance          *big.Int
	BalanceUpdatedAt uint64
}

// AgentBalanceIndexer responds to Transfer events for addresses known to be Agents, and updates their balances.
type AgentBalanceIndexer struct {
	client   *rpc.Provider
	agentIdx *AgentIndexer
	metaIdx  *AgentMetadataIndexer

	mu               sync.RWMutex
	balances         map[[32]byte]AgentBalance
	lastIndexedBlock uint64
	registryAddress  *felt.Felt

	balanceLimiter *rate.Limiter

	toUpdate   map[[32]byte]struct{}
	toUpdateMu sync.Mutex

	tickRate       time.Duration
	safeBlockDelta uint64
}

type AgentBalanceIndexerConfig struct {
	Client          *rpc.Provider
	AgentIdx        *AgentIndexer
	MetaIdx         *AgentMetadataIndexer
	RateLimiter     *rate.Limiter
	TickRate        time.Duration
	SafeBlockDelta  uint64
	RegistryAddress *felt.Felt
}

// NewAgentBalanceIndexer sets up the indexer with concurrency control and a background update interval.
func NewAgentBalanceIndexer(config *AgentBalanceIndexerConfig) *AgentBalanceIndexer {
	return &AgentBalanceIndexer{
		client:          config.Client,
		agentIdx:        config.AgentIdx,
		metaIdx:         config.MetaIdx,
		balances:        make(map[[32]byte]AgentBalance),
		balanceLimiter:  config.RateLimiter,
		toUpdate:        make(map[[32]byte]struct{}),
		tickRate:        config.TickRate,
		safeBlockDelta:  config.SafeBlockDelta,
		registryAddress: config.RegistryAddress,
	}
}

// NewAgentBalanceIndexerWithInitialState creates a new AgentBalanceIndexer with an initial state.
func NewAgentBalanceIndexerWithInitialState(config *AgentBalanceIndexerConfig, initialState map[[32]byte]AgentBalance, lastIndexedBlock uint64) *AgentBalanceIndexer {
	return &AgentBalanceIndexer{
		client:           config.Client,
		agentIdx:         config.AgentIdx,
		metaIdx:          config.MetaIdx,
		balances:         initialState,
		lastIndexedBlock: lastIndexedBlock,
		balanceLimiter:   config.RateLimiter,
		toUpdate:         make(map[[32]byte]struct{}),
		tickRate:         config.TickRate,
		safeBlockDelta:   config.SafeBlockDelta,
		registryAddress:  config.RegistryAddress,
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *AgentBalanceIndexer) Run(ctx context.Context, watcher *EventWatcher) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx, watcher)
	})
	return g.Wait()
}

func (i *AgentBalanceIndexer) run(ctx context.Context, watcher *EventWatcher) error {
	agentRegisteredCh := make(chan *EventSubscriptionData, 1000)
	agentRegisteredSubID := watcher.Subscribe(EventAgentRegistered, agentRegisteredCh)
	defer watcher.Unsubscribe(agentRegisteredSubID)

	transferCh := make(chan *EventSubscriptionData, 1000)
	transferSubID := watcher.Subscribe(EventTransfer, transferCh)
	defer watcher.Unsubscribe(transferSubID)

	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.balanceUpdateTask(ctx)
	})

	for {
		select {
		case data := <-transferCh:
			for _, ev := range data.Events {
				i.onTransferEvent(ctx, ev)
			}
		case data := <-agentRegisteredCh:
			for _, ev := range data.Events {
				i.onAgentRegisteredEvent(ctx, ev)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *AgentBalanceIndexer) onTransferEvent(ctx context.Context, ev *Event) {
	transferEvent, ok := ev.ToTransferEvent()
	if !ok {
		return
	}

	i.enqueueBalanceUpdate(transferEvent.From)
	i.enqueueBalanceUpdate(transferEvent.To)
}

func (i *AgentBalanceIndexer) onAgentRegisteredEvent(ctx context.Context, ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("agent registered event from non-registry address", "agent", ev.Raw.FromAddress)
		return
	}

	agentRegisteredEvent, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		return
	}

	i.pushAgent(agentRegisteredEvent.Agent)
}

func (i *AgentBalanceIndexer) pushAgent(addr *felt.Felt) {
	i.mu.Lock()
	defer i.mu.Unlock()

	i.balances[addr.Bytes()] = AgentBalance{
		Balance:          big.NewInt(0),
		BalanceUpdatedAt: 0,
	}
}

func (i *AgentBalanceIndexer) enqueueBalanceUpdate(addr *felt.Felt) {
	i.toUpdateMu.Lock()
	defer i.toUpdateMu.Unlock()

	i.toUpdate[addr.Bytes()] = struct{}{}
}

func (i *AgentBalanceIndexer) balanceUpdateTask(ctx context.Context) error {
	ticker := time.NewTicker(i.tickRate)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			currentBlock, err := i.client.BlockNumber(ctx)
			if err != nil {
				slog.Error("failed to get current block for balance updates", "error", err)
				continue
			}
			safeBlock := currentBlock - i.safeBlockDelta
			i.processQueue(ctx, safeBlock)
		}
	}
}

// processQueue consumes the "toUpdate" set and tries to fetch new balances.
func (i *AgentBalanceIndexer) processQueue(ctx context.Context, blockNumber uint64) {
	i.toUpdateMu.Lock()
	addresses := i.toUpdate
	i.toUpdate = make(map[[32]byte]struct{})
	i.toUpdateMu.Unlock()

	addr := new(felt.Felt)
	for addrBytes := range addresses {
		addr.SetBytes(addrBytes[:])

		// If not an agent, skip
		if _, ok := i.agentIdx.GetAgentInfo(addr); !ok {
			continue
		}

		// We need the token address from metadata
		meta, ok := i.metaIdx.GetMetadata(addr)
		if !ok {
			slog.Error("failed to get metadata for balance update", "agent", addr)
			continue
		}
		if meta.Token == nil {
			slog.Error("agent has no token in metadata", "agent", addr)
			continue
		}

		if err := i.updateBalance(ctx, addr, meta.Token, blockNumber); err != nil {
			slog.Error("failed to update agent balance", "error", err, "agent", addr)
		}
	}
}

// updateBalance does the actual "balanceOf" call at a given blockNumber
func (i *AgentBalanceIndexer) updateBalance(ctx context.Context, agent, token *felt.Felt, blockNum uint64) error {
	if i.balanceLimiter != nil {
		if err := i.balanceLimiter.Wait(ctx); err != nil {
			return fmt.Errorf("rate limit wait failed: %v", err)
		}
	}

	call := rpc.FunctionCall{
		ContractAddress:    token,
		EntryPointSelector: balanceOfSelector,
		Calldata:           []*felt.Felt{agent},
	}

	balanceResp, err := i.client.Call(ctx, call, rpc.WithBlockNumber(blockNum))
	if err != nil {
		snaccount.LogRpcError(err)
		return fmt.Errorf("balanceOf call failed: %v", err)
	}
	if len(balanceResp) != 1 {
		return fmt.Errorf("unexpected length in balanceOf response: %d", len(balanceResp))
	}

	newBalance := balanceResp[0].BigInt(nil)

	i.mu.Lock()
	defer i.mu.Unlock()

	i.balances[agent.Bytes()] = AgentBalance{
		Balance:          newBalance,
		BalanceUpdatedAt: blockNum,
	}
	return nil
}

// GetBalance returns the last known agent balance if present.
func (i *AgentBalanceIndexer) GetBalance(agent *felt.Felt) (AgentBalance, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	bal, ok := i.balances[agent.Bytes()]
	return bal, ok
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentBalanceIndexer) GetLastIndexedBlock() uint64 {
	return i.lastIndexedBlock
}

// ReadState reads the current state of the indexer.
func (i *AgentBalanceIndexer) ReadState(f func(map[[32]byte]AgentBalance, uint64)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.balances, i.lastIndexedBlock)
}
