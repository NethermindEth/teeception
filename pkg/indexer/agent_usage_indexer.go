package indexer

import (
	"context"
	"log/slog"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type AgentUsage struct {
	BreakAttempts uint64
	LatestPrompts []*AgentUsageLatestPrompt
	IsDrained     bool
}

type AgentUsageLatestPrompt struct {
	PromptID  uint64
	TweetID   uint64
	Prompt    string
	IsSuccess bool
	DrainedTo *felt.Felt
}

type AgentUsageIndexer struct {
	client starknet.ProviderWrapper

	mu sync.RWMutex

	db              AgentUsageIndexerDatabase
	registryAddress *felt.Felt

	maxPrompts uint64

	eventCh      chan *EventSubscriptionData
	eventSubID   int64
	eventWatcher *EventWatcher
}

type AgentUsageIndexerPendingUsage struct {
	Usage *AgentUsage
	Block uint64
}

type AgentUsageIndexerInitialState struct {
	Db AgentUsageIndexerDatabase
}

type AgentUsageIndexerConfig struct {
	Client          starknet.ProviderWrapper
	RegistryAddress *felt.Felt
	MaxPrompts      uint64
	InitialState    *AgentUsageIndexerInitialState
	EventWatcher    *EventWatcher
}

func NewAgentUsageIndexer(config *AgentUsageIndexerConfig) *AgentUsageIndexer {
	if config.InitialState == nil {
		config.InitialState = &AgentUsageIndexerInitialState{
			Db: NewAgentUsageIndexerDatabaseInMemory(0, config.MaxPrompts),
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := config.EventWatcher.Subscribe(EventAgentRegistered|EventPromptConsumed|EventPromptPaid, eventCh)

	return &AgentUsageIndexer{
		client:          config.Client,
		registryAddress: config.RegistryAddress,
		db:              config.InitialState.Db,
		maxPrompts:      config.MaxPrompts,
		eventCh:         eventCh,
		eventSubID:      eventSubID,
		eventWatcher:    config.EventWatcher,
	}
}

func (i *AgentUsageIndexer) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx)
	})
	return g.Wait()
}

func (i *AgentUsageIndexer) run(ctx context.Context) error {
	defer func() {
		i.eventWatcher.Unsubscribe(i.eventSubID)
	}()

	for {
		select {
		case data := <-i.eventCh:
			i.mu.Lock()
			for _, ev := range data.Events {
				if ev.Type == EventAgentRegistered {
					i.onAgentRegisteredEvent(ev)
				} else if ev.Type == EventPromptConsumed {
					i.onPromptConsumedEvent(ev)
				} else if ev.Type == EventPromptPaid {
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

func (i *AgentUsageIndexer) onAgentRegisteredEvent(ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("agent registered event from non-registry address", "agent", ev.Raw.FromAddress)
		return
	}

	agentRegisteredEvent, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		return
	}

	i.db.StoreAgent(agentRegisteredEvent.Agent.Bytes())
}

func (i *AgentUsageIndexer) onPromptConsumedEvent(ev *Event) {
	promptConsumedEvent, ok := ev.ToPromptConsumedEvent()
	if !ok {
		return
	}

	if !i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		slog.Debug("ignoring prompt consumed event for unregistered agent", "agent", ev.Raw.FromAddress)
		return
	}

	i.db.StorePromptConsumedData(ev.Raw.FromAddress.Bytes(), promptConsumedEvent)
}

func (i *AgentUsageIndexer) onPromptPaidEvent(ev *Event) {
	promptPaidEvent, ok := ev.ToPromptPaidEvent()
	if !ok {
		return
	}

	i.db.StorePromptPaidData(ev.Raw.FromAddress.Bytes(), promptPaidEvent)
}

func (i *AgentUsageIndexer) GetAgentUsage(addr *felt.Felt) (*AgentUsage, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	usage, ok := i.db.GetAgentUsage(addr.Bytes())
	return usage, ok
}

type AgentUsageIndexerTotalUsage struct {
	TotalRegisteredAgents uint64
	TotalAttempts         uint64
	TotalSuccesses        uint64
}

func (i *AgentUsageIndexer) GetTotalUsage() *AgentUsageIndexerTotalUsage {
	i.mu.RLock()
	defer i.mu.RUnlock()

	return i.db.GetTotalUsage()
}

func (i *AgentUsageIndexer) GetLastIndexedBlock() uint64 {
	return i.db.GetLastIndexedBlock()
}

func (i *AgentUsageIndexer) ReadState(f func(AgentUsageIndexerDatabaseReader)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.db)
}
