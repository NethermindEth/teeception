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
	LatestPrompts []string
}

type AgentUsageIndexer struct {
	client starknet.ProviderWrapper

	mu sync.RWMutex

	db              AgentUsageIndexerDatabase
	registryAddress *felt.Felt

	lastAgentRegisteredBlock uint64
	lastPromptPaidBlock      uint64

	maxPrompts uint64
	pending    map[[32]byte]*AgentUsageIndexerPendingUsage

	agentRegisteredCh    chan *EventSubscriptionData
	promptPaidCh         chan *EventSubscriptionData
	agentRegisteredSubID int64
	promptPaidSubID      int64
	eventWatcher         *EventWatcher
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

	agentRegisteredCh := make(chan *EventSubscriptionData, 1000)
	promptPaidCh := make(chan *EventSubscriptionData, 1000)
	agentRegisteredSubID := config.EventWatcher.Subscribe(EventAgentRegistered, agentRegisteredCh)
	promptPaidSubID := config.EventWatcher.Subscribe(EventPromptPaid, promptPaidCh)

	return &AgentUsageIndexer{
		client:                   config.Client,
		registryAddress:          config.RegistryAddress,
		db:                       config.InitialState.Db,
		maxPrompts:               config.MaxPrompts,
		lastAgentRegisteredBlock: config.InitialState.Db.GetLastIndexedBlock(),
		lastPromptPaidBlock:      config.InitialState.Db.GetLastIndexedBlock(),
		pending:                  make(map[[32]byte]*AgentUsageIndexerPendingUsage),
		agentRegisteredCh:        agentRegisteredCh,
		promptPaidCh:             promptPaidCh,
		agentRegisteredSubID:     agentRegisteredSubID,
		promptPaidSubID:          promptPaidSubID,
		eventWatcher:             config.EventWatcher,
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
		i.eventWatcher.Unsubscribe(i.agentRegisteredSubID)
		i.eventWatcher.Unsubscribe(i.promptPaidSubID)
	}()

	for {
		select {
		case data := <-i.agentRegisteredCh:
			i.mu.Lock()
			i.lastAgentRegisteredBlock = data.ToBlock
			for _, ev := range data.Events {
				i.onAgentRegisteredEvent(ev)
			}
			i.db.SetLastIndexedBlock(min(i.lastAgentRegisteredBlock, i.lastPromptPaidBlock))
			i.cleanupPending()
			i.mu.Unlock()
		case data := <-i.promptPaidCh:
			i.mu.Lock()
			i.lastPromptPaidBlock = data.ToBlock
			for _, ev := range data.Events {
				i.onPromptPaidEvent(ev)
			}
			i.db.SetLastIndexedBlock(min(i.lastAgentRegisteredBlock, i.lastPromptPaidBlock))
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

	pendingUsage, ok := i.pending[agentRegisteredEvent.Agent.Bytes()]
	if !ok {
		pendingUsage = &AgentUsageIndexerPendingUsage{
			Usage: &AgentUsage{
				BreakAttempts: 0,
				LatestPrompts: make([]string, 0, i.maxPrompts+1),
			},
		}
	} else {
		delete(i.pending, agentRegisteredEvent.Agent.Bytes())
	}

	i.db.SetAgentUsage(agentRegisteredEvent.Agent.Bytes(), pendingUsage.Usage)

}

func (i *AgentUsageIndexer) onPromptPaidEvent(ev *Event) {
	promptPaidEvent, ok := ev.ToPromptPaidEvent()
	if !ok {
		return
	}

	// Check if agent exists
	if !i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		if ev.Raw.BlockNumber <= i.lastAgentRegisteredBlock {
			slog.Debug("ignoring prompt paid event for unregistered agent", "agent", ev.Raw.FromAddress)
			return
		}

		pendingUsage, ok := i.pending[ev.Raw.FromAddress.Bytes()]
		if !ok {
			pendingUsage = &AgentUsageIndexerPendingUsage{
				Usage: &AgentUsage{
					BreakAttempts: 0,
					LatestPrompts: make([]string, 0, i.maxPrompts+1),
				},
				Block: ev.Raw.BlockNumber,
			}
		}

		i.addAttempt(pendingUsage.Usage, promptPaidEvent.Prompt)
		i.pending[ev.Raw.FromAddress.Bytes()] = pendingUsage
		return
	}

	usage, ok := i.db.GetAgentUsage(ev.Raw.FromAddress.Bytes())
	if !ok {
		slog.Error("agent usage not found", "agent", ev.Raw.FromAddress)
		return
	}

	i.addAttempt(usage, promptPaidEvent.Prompt)
	i.db.SetAgentUsage(ev.Raw.FromAddress.Bytes(), usage)
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

func (i *AgentUsageIndexer) addAttempt(usage *AgentUsage, prompt string) {
	usage.BreakAttempts++
	usage.LatestPrompts = append(usage.LatestPrompts, prompt)
	if uint64(len(usage.LatestPrompts)) > i.maxPrompts {
		usage.LatestPrompts = usage.LatestPrompts[1:]
	}
}

func (i *AgentUsageIndexer) cleanupPending() {
	for addr, pendingUsage := range i.pending {
		if pendingUsage.Block <= i.lastAgentRegisteredBlock {
			delete(i.pending, addr)
		}
	}
}
