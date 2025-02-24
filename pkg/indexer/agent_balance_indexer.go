package indexer

import (
	"context"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/juno/core/felt"

	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentBalance struct {
	Pending         bool
	Token           *felt.Felt
	PromptPrice     *big.Int
	Amount          *big.Int
	PendingAmount   *big.Int
	AmountUpdatedAt uint64
	EndTime         uint64
	IsDrained       bool
	DrainAmount     *big.Int
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

	tickRate       time.Duration
	safeBlockDelta uint64

	eventCh      chan *EventSubscriptionData
	eventSubID   int64
	eventWatcher *EventWatcher
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
	EventWatcher    *EventWatcher
}

// NewAgentBalanceIndexer creates a new AgentBalanceIndexer.
func NewAgentBalanceIndexer(config *AgentBalanceIndexerConfig) *AgentBalanceIndexer {
	if config.InitialState == nil {
		config.InitialState = &AgentBalanceIndexerInitialState{
			Db: NewAgentBalanceIndexerDatabaseInMemory(0),
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := config.EventWatcher.Subscribe(EventAgentRegistered|EventTransfer|EventDrained|EventWithdrawn|EventPromptPaid|EventPromptConsumed, eventCh)

	return &AgentBalanceIndexer{
		client:          config.Client,
		agentIdx:        config.AgentIdx,
		registryAddress: config.RegistryAddress,
		db:              config.InitialState.Db,
		priceCache:      config.PriceCache,
		tickRate:        config.TickRate,
		safeBlockDelta:  config.SafeBlockDelta,
		eventCh:         eventCh,
		eventSubID:      eventSubID,
		eventWatcher:    config.EventWatcher,
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *AgentBalanceIndexer) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx)
	})
	return g.Wait()
}

func (i *AgentBalanceIndexer) run(ctx context.Context) error {
	defer func() {
		i.eventWatcher.Unsubscribe(i.eventSubID)
	}()

	for {
		select {
		case data := <-i.eventCh:
			for _, ev := range data.Events {
				switch ev.Type {
				case EventTransfer:
					i.onTransferEvent(ctx, ev)
				case EventAgentRegistered:
					i.onAgentRegisteredEvent(ctx, ev)
				case EventDrained:
					i.onDrainedEvent(ctx, ev)
				case EventWithdrawn:
					i.onWithdrawnEvent(ctx, ev)
				case EventPromptPaid:
					i.onPromptPaidEvent(ctx, ev)
				case EventPromptConsumed:
					i.onPromptConsumedEvent(ctx, ev)
				}
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

	i.mu.Lock()
	defer i.mu.Unlock()

	// Handle incoming transfers to agents
	if i.db.GetAgentExists(transferEvent.To.Bytes()) {
		balance, _ := i.db.GetAgentBalance(transferEvent.To.Bytes())
		balance.Amount = new(big.Int).Add(balance.Amount, transferEvent.Amount)
		i.db.SetAgentBalance(transferEvent.To.Bytes(), balance)
	}

	// Handle outgoing transfers from agents
	if i.db.GetAgentExists(transferEvent.From.Bytes()) {
		balance, _ := i.db.GetAgentBalance(transferEvent.From.Bytes())
		balance.Amount = new(big.Int).Sub(balance.Amount, transferEvent.Amount)
		i.db.SetAgentBalance(transferEvent.From.Bytes(), balance)
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

	i.pushAgent(agentRegisteredEvent)

	i.mu.Lock()
	i.db.SortAgents(i.priceCache)
	i.mu.Unlock()
}

func (i *AgentBalanceIndexer) onDrainedEvent(ctx context.Context, ev *Event) {
	drainedEvent, ok := ev.ToDrainedEvent()
	if !ok {
		return
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	addrBytes := ev.Raw.FromAddress.Bytes()
	agentBalance, ok := i.db.GetAgentBalance(addrBytes)
	if !ok {
		slog.Warn("drained event for non-existent agent", "agent", ev.Raw.FromAddress.String())
		return
	}

	agentBalance.IsDrained = true
	agentBalance.DrainAmount = agentBalance.DrainAmount.Add(agentBalance.DrainAmount, drainedEvent.Amount)

	i.db.SetAgentBalance(addrBytes, agentBalance)
}

func (i *AgentBalanceIndexer) onWithdrawnEvent(ctx context.Context, ev *Event) {
	withdrawnEvent, ok := ev.ToWithdrawnEvent()
	if !ok {
		return
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	addrBytes := withdrawnEvent.To.Bytes()
	agentBalance, ok := i.db.GetAgentBalance(addrBytes)
	if !ok {
		slog.Warn("withdrawn event for non-existent agent", "agent", withdrawnEvent.To.String())
		return
	}

	agentBalance.DrainAmount = agentBalance.DrainAmount.Add(agentBalance.DrainAmount, withdrawnEvent.Amount)

	i.db.SetAgentBalance(addrBytes, agentBalance)
}

func (i *AgentBalanceIndexer) onPromptPaidEvent(ctx context.Context, ev *Event) {
	_, ok := ev.ToPromptPaidEvent()
	if !ok {
		return
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	if i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		balance, _ := i.db.GetAgentBalance(ev.Raw.FromAddress.Bytes())
		balance.PendingAmount = new(big.Int).Add(balance.PendingAmount, balance.PromptPrice)
		i.db.SetAgentBalance(ev.Raw.FromAddress.Bytes(), balance)
	}
}

func (i *AgentBalanceIndexer) onPromptConsumedEvent(ctx context.Context, ev *Event) {
	_, ok := ev.ToPromptConsumedEvent()
	if !ok {
		return
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	if i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		balance, _ := i.db.GetAgentBalance(ev.Raw.FromAddress.Bytes())
		balance.PendingAmount = new(big.Int).Sub(balance.PendingAmount, balance.PromptPrice)
		i.db.SetAgentBalance(ev.Raw.FromAddress.Bytes(), balance)
	}
}

func (i *AgentBalanceIndexer) pushAgent(ev *AgentRegisteredEvent) {
	i.mu.Lock()
	defer i.mu.Unlock()

	slog.Debug("pushing agent", "address", ev.Agent.String())

	i.db.SetAgentBalance(ev.Agent.Bytes(), &AgentBalance{
		Pending:         true,
		Token:           ev.TokenAddress,
		PromptPrice:     ev.PromptPrice,
		Amount:          big.NewInt(0),
		PendingAmount:   big.NewInt(0),
		AmountUpdatedAt: 0,
		EndTime:         ev.EndTime,
		IsDrained:       false,
		DrainAmount:     big.NewInt(0),
	})
}

func (i *AgentBalanceIndexer) GetTotalAgentBalances() map[*felt.Felt]*big.Int {
	i.mu.RLock()
	defer i.mu.RUnlock()

	balances := i.db.GetTotalAgentBalances()
	totalBalances := make(map[*felt.Felt]*big.Int)
	for tokenAddr, balance := range balances {
		token := new(felt.Felt).SetBytes(tokenAddr[:])
		totalBalances[token] = balance
	}

	return totalBalances
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
func (i *AgentBalanceIndexer) GetAgentLeaderboard(start, end uint64, isActive *bool) (*AgentLeaderboardResponse, error) {
	return i.db.GetLeaderboard(start, end, isActive, i.priceCache)
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
