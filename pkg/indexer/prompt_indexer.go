package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

// PromptIndexerConfig is the configuration for a PromptIndexer
type PromptIndexerConfig struct {
	Client          starknet.ProviderWrapper
	RegistryAddress *felt.Felt
	EventWatcher    *EventWatcher
	InitialState    *PromptIndexerInitialState
}

// PromptIndexerInitialState is the initial state for a PromptIndexer
type PromptIndexerInitialState struct {
	Db PromptIndexerDatabase
}

// PromptIndexer processes prompts and stores them in a database
type PromptIndexer struct {
	db              PromptIndexerDatabase
	registryAddress *felt.Felt
	client          starknet.ProviderWrapper

	eventCh      chan *EventSubscriptionData
	eventSubID   int64
	eventWatcher *EventWatcher

	mu sync.RWMutex
}

// NewPromptIndexer creates a new PromptIndexer
func NewPromptIndexer(cfg *PromptIndexerConfig) (*PromptIndexer, error) {
	if cfg.InitialState == nil {
		db, err := NewPromptIndexerDatabaseSQLite("prompts.db")
		if err != nil {
			slog.Error("failed to create database", "error", err)
			return nil, fmt.Errorf("failed to create database: %w", err)
		}

		cfg.InitialState = &PromptIndexerInitialState{
			Db: db,
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := cfg.EventWatcher.Subscribe(EventAgentRegistered|EventPromptPaid, eventCh)

	return &PromptIndexer{
		db:              cfg.InitialState.Db,
		registryAddress: cfg.RegistryAddress,
		client:          cfg.Client,
		eventCh:         eventCh,
		eventSubID:      eventSubID,
		eventWatcher:    cfg.EventWatcher,
	}, nil
}

// Run starts the main indexing loop
func (i *PromptIndexer) Run(ctx context.Context) error {
	defer i.eventWatcher.Unsubscribe(i.eventSubID)

	for {
		select {
		case data := <-i.eventCh:
			i.mu.Lock()
			for _, ev := range data.Events {
				if ev.Type == EventPromptPaid {
					i.onPromptPaid(ev)
				} else if ev.Type == EventAgentRegistered {
					i.onAgentRegistered(ev)
				}
			}
			if err := i.db.SetLastIndexedBlock(data.ToBlock); err != nil {
				slog.Error("failed to set last indexed block", "error", err)
			}
			i.mu.Unlock()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *PromptIndexer) onPromptPaid(ev *Event) {
	if !i.db.GetAgentExists(ev.Raw.FromAddress.Bytes()) {
		slog.Debug("ignoring prompt paid event for unregistered agent", "agent", ev.Raw.FromAddress)
		return
	}

	promptPaidEv, ok := ev.ToPromptPaidEvent()
	if !ok {
		slog.Error("failed to parse prompt paid event")
		return
	}

	// Check if prompt already exists
	_, exists := i.db.GetPrompt(promptPaidEv.PromptID, ev.Raw.FromAddress)
	if exists {
		// If prompt exists, keep it as is
		slog.Info("prompt already exists, skipping", "prompt_id", promptPaidEv.PromptID)
		return
	}

	// Store the prompt data
	data := &PromptData{
		Pending:     true,
		PromptID:    promptPaidEv.PromptID,
		AgentAddr:   ev.Raw.FromAddress,
		IsDrain:     false,
		Prompt:      promptPaidEv.Prompt,
		BlockNumber: ev.Raw.BlockNumber,
		UserAddr:    promptPaidEv.User,
	}

	if err := i.RegisterPromptResponse(data, false); err != nil {
		slog.Error("failed to store prompt", "error", err)
	}
}

func (i *PromptIndexer) onAgentRegistered(ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("received agent registered event from non-registry address", "address", ev.Raw.FromAddress)
		return
	}

	agentRegisteredEv, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		slog.Error("failed to parse agent registered event")
		return
	}

	i.db.SetAgentExists(agentRegisteredEv.Agent.Bytes(), true)
}

// RegisterPromptResponse registers a prompt response manually
func (i *PromptIndexer) RegisterPromptResponse(data *PromptData, isUpsert bool) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	existingData, exists := i.db.GetPrompt(data.PromptID, data.AgentAddr)
	if exists {
		if !isUpsert {
			return nil
		}

		// If prompt exists, update it
		existingData.Pending = false
		existingData.Response = data.Response
		existingData.Error = data.Error
		return i.db.SetPrompt(existingData)
	}

	// If prompt doesn't exist, store the complete data
	return i.db.SetPrompt(data)
}

// GetPrompt returns a prompt by its ID and agent address
func (i *PromptIndexer) GetPrompt(promptID uint64, agentAddr *felt.Felt) (*PromptData, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.db.GetPrompt(promptID, agentAddr)
}

// GetPromptsByAgent returns all prompts for a given agent
func (i *PromptIndexer) GetPromptsByAgent(agentAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.db.GetPromptsByAgent(agentAddr, from, to)
}

// GetPromptsByUser returns all prompts for a given user
func (i *PromptIndexer) GetPromptsByUser(userAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.db.GetPromptsByUser(userAddr, from, to)
}

// GetPromptsByUserAndAgent returns all prompts for a given user and agent
func (i *PromptIndexer) GetPromptsByUserAndAgent(userAddr *felt.Felt, agentAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.db.GetPromptsByUserAndAgent(userAddr, agentAddr, from, to)
}

// GetLastIndexedBlock returns the last indexed block
func (i *PromptIndexer) GetLastIndexedBlock() uint64 {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.db.GetLastIndexedBlock()
}
