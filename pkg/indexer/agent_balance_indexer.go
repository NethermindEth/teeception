package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"math/big"
	"slices"
	"sort"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentBalance struct {
	Token           *felt.Felt
	Amount          *big.Int
	AmountUpdatedAt uint64
}

type AgentBalanceIndexerPriceCache interface {
	GetTokenUsdPrice(token *felt.Felt) (*big.Int, bool)
}

// AgentBalanceIndexer responds to Transfer events for addresses known to be Agents, and updates their balances.
type AgentBalanceIndexer struct {
	client   *rpc.Provider
	agentIdx *AgentIndexer
	metaIdx  *AgentMetadataIndexer

	mu sync.RWMutex

	balances         map[[32]byte]*AgentBalance
	lastIndexedBlock uint64
	registryAddress  *felt.Felt

	sortedAgentsMu  sync.RWMutex
	sortedAgents    [][32]byte
	sortedAgentsLen int
	priceCache      AgentBalanceIndexerPriceCache

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
	PriceCache      AgentBalanceIndexerPriceCache
}

// NewAgentBalanceIndexer sets up the indexer with concurrency control and a background update interval.
func NewAgentBalanceIndexer(config *AgentBalanceIndexerConfig) *AgentBalanceIndexer {
	return &AgentBalanceIndexer{
		client:          config.Client,
		agentIdx:        config.AgentIdx,
		metaIdx:         config.MetaIdx,
		registryAddress: config.RegistryAddress,
		sortedAgents:    make([][32]byte, 0),
		sortedAgentsLen: 0,
		priceCache:      config.PriceCache,
		balances:        make(map[[32]byte]*AgentBalance),
		balanceLimiter:  config.RateLimiter,
		toUpdate:        make(map[[32]byte]struct{}),
		tickRate:        config.TickRate,
		safeBlockDelta:  config.SafeBlockDelta,
	}
}

// NewAgentBalanceIndexerWithInitialState creates a new AgentBalanceIndexer with an initial state.
func NewAgentBalanceIndexerWithInitialState(config *AgentBalanceIndexerConfig, initialState map[[32]byte]*AgentBalance, lastIndexedBlock uint64) *AgentBalanceIndexer {
	return &AgentBalanceIndexer{
		client:           config.Client,
		agentIdx:         config.AgentIdx,
		metaIdx:          config.MetaIdx,
		registryAddress:  config.RegistryAddress,
		sortedAgents:     slices.Collect(maps.Keys(initialState)),
		sortedAgentsLen:  0,
		priceCache:       config.PriceCache,
		balances:         initialState,
		lastIndexedBlock: lastIndexedBlock,
		balanceLimiter:   config.RateLimiter,
		toUpdate:         make(map[[32]byte]struct{}),
		tickRate:         config.TickRate,
		safeBlockDelta:   config.SafeBlockDelta,
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

	i.balances[addr.Bytes()] = &AgentBalance{
		Token:           nil,
		Amount:          big.NewInt(0),
		AmountUpdatedAt: 0,
	}
	i.sortedAgents = append(i.sortedAgents, addr.Bytes())
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

		if err := i.updateBalance(ctx, addr, blockNumber); err != nil {
			slog.Error("failed to update agent balance", "error", err, "agent", addr)
		}
	}

	i.sortAgents()
}

// sortAgents sorts the agents by balance in descending order, using USD value
func (i *AgentBalanceIndexer) sortAgents() {
	i.mu.RLock()
	defer i.mu.RUnlock()

	i.sortedAgentsMu.Lock()
	defer i.sortedAgentsMu.Unlock()

	i.sortedAgentsLen = len(i.balances)

	if len(i.sortedAgents) != len(i.balances) {
		i.sortedAgents = slices.Collect(maps.Keys(i.balances))
	}

	sort.Slice(i.sortedAgents, func(a, b int) bool {
		balA := i.balances[i.sortedAgents[a]]
		balB := i.balances[i.sortedAgents[b]]

		if balA.Token == balB.Token {
			return balA.Amount.Cmp(balB.Amount) > 0
		}

		usdRateA, ok := i.priceCache.GetTokenUsdPrice(balA.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "agent", balA.Token)
			return false
		}

		usdRateB, ok := i.priceCache.GetTokenUsdPrice(balB.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "agent", balB.Token)
			return false
		}

		return balA.Amount.Mul(balA.Amount, usdRateA).Cmp(balB.Amount.Mul(balB.Amount, usdRateB)) > 0
	})
}

// updateBalance does the actual "balanceOf" call at a given blockNumber
func (i *AgentBalanceIndexer) updateBalance(ctx context.Context, agent *felt.Felt, blockNum uint64) error {
	if i.balanceLimiter != nil {
		if err := i.balanceLimiter.Wait(ctx); err != nil {
			return fmt.Errorf("rate limit wait failed: %v", err)
		}
	}

	currentInfo, ok := i.GetBalance(agent)
	if !ok {
		currentInfo = &AgentBalance{
			Token:           nil,
			Amount:          big.NewInt(0),
			AmountUpdatedAt: 0,
		}
	}

	if currentInfo.Token == nil {
		// We need the token address from metadata
		meta, ok := i.metaIdx.GetMetadata(agent)
		if !ok {
			slog.Error("failed to get metadata for balance update", "agent", agent)
			return fmt.Errorf("failed to get metadata for balance update")
		}
		if meta.Token == nil {
			slog.Error("agent has no token in metadata", "agent", agent)
			return fmt.Errorf("agent has no token in metadata")
		}

		currentInfo.Token = meta.Token
	}

	call := rpc.FunctionCall{
		ContractAddress:    currentInfo.Token,
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

	currentInfo.Amount = newBalance
	currentInfo.AmountUpdatedAt = blockNum

	return nil
}

// GetBalance returns the last known agent balance if present.
func (i *AgentBalanceIndexer) GetBalance(agent *felt.Felt) (*AgentBalance, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	bal, ok := i.balances[agent.Bytes()]
	return bal, ok
}

type AgentLeaderboardResponse struct {
	Agents     [][32]byte
	AgentCount uint64
	LastBlock  uint64
}

// GetAgentLeaderboard returns start:end agents from the agent balance leaderboard provided a callback to get a token's rate.
func (i *AgentBalanceIndexer) GetAgentLeaderboard(start, end uint64) (*AgentLeaderboardResponse, error) {
	if start > end {
		return nil, fmt.Errorf("invalid range: start (%d) > end (%d)", start, end)
	}

	i.sortedAgentsMu.RLock()
	defer i.sortedAgentsMu.RUnlock()

	if start >= uint64(i.sortedAgentsLen) {
		return nil, fmt.Errorf("start index out of bounds: %d", start)
	}

	if end > uint64(i.sortedAgentsLen) {
		end = uint64(i.sortedAgentsLen)
	}

	return &AgentLeaderboardResponse{
		Agents:     i.sortedAgents[start:end],
		AgentCount: uint64(i.sortedAgentsLen),
		LastBlock:  i.lastIndexedBlock,
	}, nil
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentBalanceIndexer) GetLastIndexedBlock() uint64 {
	return i.lastIndexedBlock
}

// ReadState reads the current state of the indexer.
func (i *AgentBalanceIndexer) ReadState(f func(map[[32]byte]*AgentBalance, uint64)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.balances, i.lastIndexedBlock)
}
