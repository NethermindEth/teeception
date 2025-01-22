package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"math/big"
	"slices"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"

	"github.com/NethermindEth/teeception/pkg/indexer/utils"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentBalance struct {
	Token           *felt.Felt
	Amount          *big.Int
	AmountUpdatedAt uint64
}

type AgentBalanceIndexerPriceCache interface {
	GetTokenRate(token *felt.Felt) (*big.Int, bool)
}

// AgentBalanceIndexer responds to Transfer events for addresses known to be Agents, and updates their balances.
type AgentBalanceIndexer struct {
	client   *starknet.RateLimitedProvider
	agentIdx *AgentIndexer
	metaIdx  *AgentMetadataIndexer

	mu sync.RWMutex

	balances         map[[32]byte]*AgentBalance
	lastIndexedBlock uint64
	registryAddress  *felt.Felt

	sortedAgentsMu sync.RWMutex
	sortedAgents   *utils.LazySortedList[[32]byte]
	priceCache     AgentBalanceIndexerPriceCache

	toUpdate   map[[32]byte]struct{}
	toUpdateMu sync.Mutex

	tickRate       time.Duration
	safeBlockDelta uint64
}

// AgentBalanceIndexerInitialState is the initial state for an AgentBalanceIndexer.
type AgentBalanceIndexerInitialState struct {
	Balances         map[[32]byte]*AgentBalance
	LastIndexedBlock uint64
}

// AgentBalanceIndexerConfig is the configuration for an AgentBalanceIndexer.
type AgentBalanceIndexerConfig struct {
	Client          *starknet.RateLimitedProvider
	AgentIdx        *AgentIndexer
	MetaIdx         *AgentMetadataIndexer
	TickRate        time.Duration
	SafeBlockDelta  uint64
	RegistryAddress *felt.Felt
	PriceCache      AgentBalanceIndexerPriceCache
	InitialState    *AgentBalanceIndexerInitialState
}

// NewAgentBalanceIndexer creates a new AgentBalanceIndexer.
func NewAgentBalanceIndexer(config *AgentBalanceIndexerConfig) *AgentBalanceIndexer {
	if config.InitialState == nil {
		config.InitialState = &AgentBalanceIndexerInitialState{
			Balances:         make(map[[32]byte]*AgentBalance),
			LastIndexedBlock: 0,
		}
	}

	return &AgentBalanceIndexer{
		client:           config.Client,
		agentIdx:         config.AgentIdx,
		metaIdx:          config.MetaIdx,
		registryAddress:  config.RegistryAddress,
		sortedAgents:     utils.NewLazySortedList[[32]byte](),
		priceCache:       config.PriceCache,
		balances:         config.InitialState.Balances,
		lastIndexedBlock: config.InitialState.LastIndexedBlock,
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

	if _, ok := i.balances[transferEvent.From.Bytes()]; ok {
		slog.Debug("enqueueing balance update for from", "address", transferEvent.From.String())
	}
	if _, ok := i.balances[transferEvent.To.Bytes()]; ok {
		slog.Debug("enqueueing balance update for to", "address", transferEvent.To.String())
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

	slog.Debug("enqueueing balance update for agent registered", "address", agentRegisteredEvent.Agent.String())
	i.enqueueBalanceUpdate(agentRegisteredEvent.Agent)
}

func (i *AgentBalanceIndexer) pushAgent(addr *felt.Felt) {
	i.mu.Lock()
	defer i.mu.Unlock()

	i.balances[addr.Bytes()] = &AgentBalance{
		Token:           nil,
		Amount:          big.NewInt(0),
		AmountUpdatedAt: 0,
	}
	i.sortedAgents.Add(addr.Bytes())
}

func (i *AgentBalanceIndexer) enqueueBalanceUpdate(addr *felt.Felt) {
	i.toUpdateMu.Lock()
	defer i.toUpdateMu.Unlock()

	if _, ok := i.balances[addr.Bytes()]; !ok {
		slog.Debug("agent not found in balances", "address", addr.String())
		return
	}

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
			var currentBlock uint64
			var err error

			if err := i.client.Do(func(provider *rpc.Provider) error {
				currentBlock, err = provider.BlockNumber(ctx)
				if err != nil {
					return err
				}

				return nil
			}); err != nil {
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
	slog.Info("processing balance update queue", "block", blockNumber)

	i.toUpdateMu.Lock()
	addresses := i.toUpdate
	i.toUpdate = make(map[[32]byte]struct{})
	i.toUpdateMu.Unlock()

	addr := new(felt.Felt)
	for addrBytes := range addresses {
		addr.SetBytes(addrBytes[:])

		slog.Debug("processing balance update", "address", addr.String())

		// If not an agent, skip
		if _, ok := i.agentIdx.GetAgentInfo(addr); !ok {
			slog.Warn("agent not found in agent index", "address", addr.String())
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

	if i.sortedAgents.InnerLen() != len(i.balances) {
		i.sortedAgents.Add(slices.Collect(maps.Keys(i.balances))...)
	}

	i.sortedAgents.Sort(func(a, b [32]byte) int {
		balA := i.balances[a]
		balB := i.balances[b]

		if balA.Token == balB.Token {
			return -balA.Amount.Cmp(balB.Amount)
		}

		rateA, ok := i.priceCache.GetTokenRate(balA.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "agent", balA.Token)
			return 0
		}

		rateB, ok := i.priceCache.GetTokenRate(balB.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "agent", balB.Token)
			return 0
		}

		return -balA.Amount.Mul(balA.Amount, rateA).Cmp(balB.Amount.Mul(balB.Amount, rateB))
	})
}

// updateBalance does the actual "balanceOf" call at a given blockNumber
func (i *AgentBalanceIndexer) updateBalance(ctx context.Context, agent *felt.Felt, blockNum uint64) error {
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

	var balanceResp []*felt.Felt
	var err error

	if err := i.client.Do(func(provider *rpc.Provider) error {
		balanceResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    currentInfo.Token,
			EntryPointSelector: balanceOfSelector,
			Calldata:           []*felt.Felt{agent},
		}, rpc.WithBlockNumber(blockNum))

		return err
	}); err != nil {
		snaccount.LogRpcError(err)
		return fmt.Errorf("balanceOf call failed: %v", err)
	}

	var amount *big.Int
	if len(balanceResp) == 1 {
		amount = balanceResp[0].BigInt(new(big.Int))
	} else if len(balanceResp) == 2 {
		amount = snaccount.Uint256ToBigInt([2]*felt.Felt(balanceResp[0:2]))
	} else {
		return fmt.Errorf("unexpected length in balanceOf response: %d", len(balanceResp))
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	currentInfo.Amount = amount
	currentInfo.AmountUpdatedAt = blockNum
	i.balances[agent.Bytes()] = currentInfo

	return nil
}

// GetBalance returns the last known agent balance if present.
func (i *AgentBalanceIndexer) GetBalance(agent *felt.Felt) (*AgentBalance, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	bal, ok := i.balances[agent.Bytes()]
	if bal.Token == nil || bal.Amount == nil {
		return nil, false
	}

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

	if i.sortedAgents.Len() == 0 {
		return &AgentLeaderboardResponse{
			Agents:     make([][32]byte, 0),
			AgentCount: 0,
			LastBlock:  i.lastIndexedBlock,
		}, nil
	}

	if start >= uint64(i.sortedAgents.Len()) {
		return nil, fmt.Errorf("start index out of bounds: %d", start)
	}

	if end > uint64(i.sortedAgents.Len()) {
		end = uint64(i.sortedAgents.Len())
	}

	agents, ok := i.sortedAgents.GetRange(int(start), int(end))
	if !ok {
		return nil, fmt.Errorf("failed to get range of agents")
	}

	return &AgentLeaderboardResponse{
		Agents:     agents,
		AgentCount: uint64(i.sortedAgents.Len()),
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
