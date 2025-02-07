package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	lru "github.com/hashicorp/golang-lru/v2"
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
	Prompt    string
	IsSuccess bool
	DrainedTo *felt.Felt
}

type AgentUsageIndexer struct {
	client starknet.ProviderWrapper

	mu sync.RWMutex

	db              AgentUsageIndexerDatabase
	registryAddress *felt.Felt

	maxPrompts  uint64
	promptCache *lru.Cache[string, string]

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
			Db: NewAgentUsageIndexerDatabaseInMemory(0),
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := config.EventWatcher.Subscribe(EventAgentRegistered|EventPromptConsumed|EventPromptPaid, eventCh)

	promptCache, err := lru.New[string, string](1000)
	if err != nil {
		slog.Error("failed to create prompt cache", "error", err)
		promptCache = nil
	}

	return &AgentUsageIndexer{
		client:          config.Client,
		registryAddress: config.RegistryAddress,
		db:              config.InitialState.Db,
		maxPrompts:      config.MaxPrompts,
		promptCache:     promptCache,
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

	i.db.SetAgentUsage(agentRegisteredEvent.Agent.Bytes(), &AgentUsage{
		BreakAttempts: 0,
		LatestPrompts: make([]*AgentUsageLatestPrompt, 0, i.maxPrompts+1),
	})
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

	usage, ok := i.db.GetAgentUsage(ev.Raw.FromAddress.Bytes())
	if !ok {
		slog.Error("agent usage not found", "agent", ev.Raw.FromAddress)
		return
	}

	i.addAttempt(usage, ev.Raw.FromAddress, promptConsumedEvent.PromptID, promptConsumedEvent.DrainedTo)
	i.db.SetAgentUsage(ev.Raw.FromAddress.Bytes(), usage)
}

func (i *AgentUsageIndexer) onPromptPaidEvent(ev *Event) {
	promptPaidEvent, ok := ev.ToPromptPaidEvent()
	if !ok {
		return
	}

	i.promptCache.Add(
		fmt.Sprintf("%s-%d", ev.Raw.FromAddress, promptPaidEvent.PromptID),
		promptPaidEvent.Prompt,
	)
}

func (i *AgentUsageIndexer) GetAgentUsage(addr *felt.Felt) (*AgentUsage, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	usage, ok := i.db.GetAgentUsage(addr.Bytes())
	return usage, ok
}

func (i *AgentUsageIndexer) GetLastIndexedBlock() uint64 {
	return i.db.GetLastIndexedBlock()
}

func (i *AgentUsageIndexer) ReadState(f func(AgentUsageIndexerDatabaseReader)) {
	i.mu.RLock()
	defer i.mu.RUnlock()

	f(i.db)
}

func (i *AgentUsageIndexer) addAttempt(usage *AgentUsage, agentAddr *felt.Felt, promptId uint64, drainedTo *felt.Felt) {
	usage.BreakAttempts++

	var succeeded bool
	var drainAddress *felt.Felt

	if drainedTo.Cmp(agentAddr) == 0 {
		succeeded = false
		drainAddress = new(felt.Felt)
	} else {
		succeeded = true
		drainAddress = drainedTo
	}

	prompt, ok := i.promptCache.Get(fmt.Sprintf("%s-%d", agentAddr, promptId))
	if !ok {
		slog.Error("prompt not found in cache", "agent", agentAddr, "prompt", promptId)
		prompt = ""
	}

	if succeeded {
		usage.IsDrained = true
	}

	usage.LatestPrompts = append(usage.LatestPrompts, &AgentUsageLatestPrompt{
		Prompt:    prompt,
		IsSuccess: succeeded,
		DrainedTo: drainAddress,
	})
	if uint64(len(usage.LatestPrompts)) > i.maxPrompts {
		usage.LatestPrompts = usage.LatestPrompts[1:]
	}
}
