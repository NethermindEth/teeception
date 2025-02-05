package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"

	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentBalance struct {
	Pending         bool
	Token           *felt.Felt
	Amount          *big.Int
	AmountUpdatedAt uint64
	EndTime         uint64
}

type AgentBalanceIndexerPriceCache interface {
	GetTokenRate(token *felt.Felt) (*big.Int, bool)
}

// AgentBalanceIndexer responds to Transfer events for addresses known to be Agents, and updates their balances.
type AgentBalanceIndexer struct {
	client   starknet.ProviderWrapper
	agentIdx *AgentIndexer

	mu sync.RWMutex

	db              AgentBalanceIndexerDatabase
	registryAddress *felt.Felt

	priceCache AgentBalanceIndexerPriceCache

	toUpdate   map[[32]byte]struct{}
	toUpdateMu sync.Mutex

	tickRate       time.Duration
	safeBlockDelta uint64
}

// AgentBalanceIndexerInitialState is the initial state for an AgentBalanceIndexer.
type AgentBalanceIndexerInitialState struct {
	Db AgentBalanceIndexerDatabase
}

// AgentBalanceIndexerConfig is the configuration for an AgentBalanceIndexer.
type AgentBalanceIndexerConfig struct {
	Client          starknet.ProviderWrapper
	AgentIdx        *AgentIndexer
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
			Db: NewAgentBalanceIndexerDatabaseInMemory(0),
		}
	}

	return &AgentBalanceIndexer{
		client:          config.Client,
		agentIdx:        config.AgentIdx,
		registryAddress: config.RegistryAddress,
		db:              config.InitialState.Db,
		priceCache:      config.PriceCache,
		toUpdate:        make(map[[32]byte]struct{}),
		tickRate:        config.TickRate,
		safeBlockDelta:  config.SafeBlockDelta,
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

	if i.db.GetAgentExists(transferEvent.From.Bytes()) {
		slog.Debug("enqueueing balance update for from", "address", transferEvent.From.String())
		i.enqueueBalanceUpdate(transferEvent.From)
	}
	if i.db.GetAgentExists(transferEvent.To.Bytes()) {
		slog.Debug("enqueueing balance update for to", "address", transferEvent.To.String())
		i.enqueueBalanceUpdate(transferEvent.To)
	}
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

	i.db.SetAgentBalance(addr.Bytes(), &AgentBalance{
		Pending:         true,
		Token:           nil,
		Amount:          big.NewInt(0),
		AmountUpdatedAt: 0,
		EndTime:         0,
	})
}

func (i *AgentBalanceIndexer) enqueueBalanceUpdate(addr *felt.Felt) {
	i.toUpdateMu.Lock()
	defer i.toUpdateMu.Unlock()

	if !i.db.GetAgentExists(addr.Bytes()) {
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

			if err := i.client.Do(func(provider rpc.RpcProvider) error {
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
		info, ok := i.agentIdx.GetAgentInfo(addr)
		if !ok {
			slog.Warn("agent not found in agent index", "address", addr.String())
			continue
		}

		currentTime := time.Now().Unix()

		if info.EndTime < uint64(currentTime) {
			slog.Debug("agent has expired", "address", addr.String(), "end_time", info.EndTime, "block", blockNumber)
			continue
		}

		if err := i.updateBalance(ctx, addr, blockNumber); err != nil {
			slog.Error("failed to update agent balance", "error", err, "agent", addr)
		}
	}

	i.mu.RLock()
	defer i.mu.RUnlock()

	i.db.SortAgents(i.priceCache)
}

// updateBalance does the actual "balanceOf" call at a given blockNumber
func (i *AgentBalanceIndexer) updateBalance(ctx context.Context, agent *felt.Felt, blockNum uint64) error {
	currentInfo, ok := i.GetBalance(agent)
	if !ok {
		currentInfo = &AgentBalance{
			Pending:         true,
			Token:           new(felt.Felt),
			Amount:          big.NewInt(0),
			AmountUpdatedAt: 0,
			EndTime:         0,
		}
	}

	if currentInfo.Token == nil {
		// We need the token address from metadata
		info, ok := i.agentIdx.GetAgentInfo(agent)
		if !ok {
			slog.Error("failed to get metadata for balance update", "agent", agent)
			return fmt.Errorf("failed to get metadata for balance update")
		}
		if info.TokenAddress == nil {
			slog.Error("agent has no token in metadata", "agent", agent)
			return fmt.Errorf("agent has no token in metadata")
		}

		currentInfo.Token = info.TokenAddress
		currentInfo.EndTime = info.EndTime
	}

	var balanceResp []*felt.Felt
	var err error

	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		balanceResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    agent,
			EntryPointSelector: getPrizePoolSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockNumber(blockNum))

		return err
	}); err != nil {
		return fmt.Errorf("get_prize_pool call failed: %w", snaccount.FormatRpcError(err))
	}

	var amount *big.Int
	if len(balanceResp) == 1 {
		amount = balanceResp[0].BigInt(new(big.Int))
	} else if len(balanceResp) == 2 {
		amount = snaccount.Uint256ToBigInt([2]*felt.Felt(balanceResp[0:2]))
	} else {
		return fmt.Errorf("unexpected length in balanceOf response: %d", len(balanceResp))
	}

	currentInfo.Pending = false
	currentInfo.Amount = amount
	currentInfo.AmountUpdatedAt = blockNum

	i.mu.Lock()
	i.db.SetAgentBalance(agent.Bytes(), currentInfo)
	i.mu.Unlock()

	return nil
}

// GetBalance returns the last known agent balance if present.
func (i *AgentBalanceIndexer) GetBalance(agent *felt.Felt) (*AgentBalance, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	bal, ok := i.db.GetAgentBalance(agent.Bytes())

	return bal, ok
}

// GetAgentLeaderboardCount returns the number of agents in the leaderboard.
func (i *AgentBalanceIndexer) GetAgentLeaderboardCount() uint64 {
	return i.db.GetLeaderboardCount()
}

type AgentLeaderboardResponse struct {
	Agents     [][32]byte
	AgentCount uint64
	LastBlock  uint64
}

// GetAgentLeaderboard returns start:end agents from the agent balance leaderboard provided a callback to get a token's rate.
func (i *AgentBalanceIndexer) GetAgentLeaderboard(start, end uint64) (*AgentLeaderboardResponse, error) {
	return i.db.GetLeaderboard(start, end, i.priceCache)
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentBalanceIndexer) GetLastIndexedBlock() uint64 {
	return i.db.GetLastIndexedBlock()
}

// ReadState reads the current state of the indexer.
func (i *AgentBalanceIndexer) ReadState(f func(AgentBalanceIndexerDatabaseReader)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.db)
}
