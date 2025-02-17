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

type UserInfo struct {
	Address         [32]byte
	AccruedBalances map[[32]byte]*big.Int
	PromptCount     uint64
	BreakCount      uint64
}

type UserIndexer struct {
	client starknet.ProviderWrapper

	mu sync.RWMutex

	db              UserIndexerDatabase
	registryAddress *felt.Felt
	priceCache      AgentBalanceIndexerPriceCache

	eventCh      chan *EventSubscriptionData
	eventSubID   int64
	eventWatcher *EventWatcher

	tickRate time.Duration
}

type UserIndexerInitialState struct {
	Db UserIndexerDatabase
}

type UserIndexerConfig struct {
	Client          starknet.ProviderWrapper
	RegistryAddress *felt.Felt
	InitialState    *UserIndexerInitialState
	EventWatcher    *EventWatcher
	TickRate        time.Duration
	PriceCache      AgentBalanceIndexerPriceCache
}

func NewUserIndexer(config *UserIndexerConfig) *UserIndexer {
	if config.InitialState == nil {
		config.InitialState = &UserIndexerInitialState{
			Db: NewUserIndexerDatabaseInMemory(0),
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := config.EventWatcher.Subscribe(EventAgentRegistered|EventPromptConsumed|EventPromptPaid, eventCh)

	return &UserIndexer{
		client:          config.Client,
		registryAddress: config.RegistryAddress,
		db:              config.InitialState.Db,
		priceCache:      config.PriceCache,
		eventCh:         eventCh,
		eventSubID:      eventSubID,
		eventWatcher:    config.EventWatcher,
		tickRate:        config.TickRate,
	}
}

func (i *UserIndexer) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.sortTask(ctx)
	})
	g.Go(func() error {
		return i.run(ctx)
	})
	return g.Wait()
}

func (i *UserIndexer) sortTask(ctx context.Context) error {
	ticker := time.NewTicker(i.tickRate)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			i.mu.Lock()
			i.db.SortUsers(i.priceCache)
			i.mu.Unlock()
		}
	}
}

func (i *UserIndexer) run(ctx context.Context) error {
	defer func() {
		i.eventWatcher.Unsubscribe(i.eventSubID)
	}()

	for {
		select {
		case data := <-i.eventCh:
			i.mu.Lock()
			for _, ev := range data.Events {
				switch ev.Type {
				case EventAgentRegistered:
					i.onAgentRegisteredEvent(ev)
				case EventPromptConsumed:
					i.onPromptConsumedEvent(ev)
				case EventPromptPaid:
					i.onPromptPaidEvent(ev)
				}
			}
			i.db.SetLastIndexedBlock(data.ToBlock)
			i.mu.Unlock()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *UserIndexer) onAgentRegisteredEvent(ev *Event) {
	agentRegisteredEvent, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		slog.Error("failed to parse agent registered event")
		return
	}

	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		return
	}

	i.db.StoreAgentRegisteredData(agentRegisteredEvent)
}

func (i *UserIndexer) onPromptConsumedEvent(ev *Event) {
	promptConsumedEvent, ok := ev.ToPromptConsumedEvent()
	if !ok {
		slog.Error("failed to parse prompt consumed event")
		return
	}

	if !i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		return
	}

	i.db.StorePromptConsumedData(ev.Raw.FromAddress, promptConsumedEvent)
}

func (i *UserIndexer) onPromptPaidEvent(ev *Event) {
	promptPaidEvent, ok := ev.ToPromptPaidEvent()
	if !ok {
		slog.Error("failed to parse prompt paid event")
		return
	}

	if !i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		return
	}

	i.db.StorePromptPaidData(ev.Raw.FromAddress, promptPaidEvent)
}

// GetUserLeaderboardCount returns the number of users in the leaderboard.
func (i *UserIndexer) GetUserLeaderboardCount() uint64 {
	return i.db.GetLeaderboardCount()
}

// GetUserLeaderboard returns start:end users from the user leaderboard.
// Users are sorted by total accrued balances (desc), break count (desc) and prompt count (desc).
func (i *UserIndexer) GetUserLeaderboard(start, end uint64) (*UserLeaderboardResponse, error) {
	return i.db.GetLeaderboard(start, end, i.priceCache)
}

func (i *UserIndexer) GetUserInfo(addr *felt.Felt) (*UserInfo, bool) {
	return i.db.GetUserInfo(addr.Bytes())
}

func (i *UserIndexer) GetLastIndexedBlock() uint64 {
	return i.db.GetLastIndexedBlock()
}

func (i *UserIndexer) ReadState(f func(UserIndexerDatabaseReader)) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	f(i.db)
}
