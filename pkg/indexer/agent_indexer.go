package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"
)

type AgentInfo struct {
	Address      *felt.Felt
	Name         string
	SystemPrompt string
}

// AgentIndexer processes AgentRegistered events and tracks known agents.
type AgentIndexer struct {
	agentsMu         sync.RWMutex
	agents           map[[32]byte]AgentInfo
	addresses        []*felt.Felt
	registryAddress  *felt.Felt
	lastIndexedBlock uint64
	rateLimiter      *rate.Limiter
	client           *rpc.Provider
}

// AgentIndexerConfig is the configuration for an AgentIndexer.
type AgentIndexerConfig struct {
	RegistryAddress *felt.Felt
	RateLimiter     *rate.Limiter
	Client          *rpc.Provider
}

// NewAgentIndexer instantiates an AgentIndexer.
func NewAgentIndexer(cfg *AgentIndexerConfig) *AgentIndexer {
	return &AgentIndexer{
		agents:          make(map[[32]byte]AgentInfo),
		registryAddress: cfg.RegistryAddress,
		rateLimiter:     cfg.RateLimiter,
		client:          cfg.Client,
	}
}

// NewAgentIndexerWithInitialState creates a new AgentIndexer with an initial state.
func NewAgentIndexerWithInitialState(cfg AgentIndexerConfig, initialState map[[32]byte]AgentInfo, lastIndexedBlock uint64) *AgentIndexer {
	return &AgentIndexer{
		agents:           initialState,
		registryAddress:  cfg.RegistryAddress,
		lastIndexedBlock: lastIndexedBlock,
		rateLimiter:      cfg.RateLimiter,
		client:           cfg.Client,
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *AgentIndexer) Run(ctx context.Context, watcher *EventWatcher) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx, watcher)
	})
	return g.Wait()
}

func (i *AgentIndexer) run(ctx context.Context, watcher *EventWatcher) error {
	ch := make(chan *EventSubscriptionData, 1000)
	subID := watcher.Subscribe(EventAgentRegistered, ch)
	defer watcher.Unsubscribe(subID)

	for {
		select {
		case data := <-ch:
			i.agentsMu.Lock()
			for _, ev := range data.Events {
				i.onAgentRegistered(ev)
			}
			i.lastIndexedBlock = data.ToBlock
			i.agentsMu.Unlock()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *AgentIndexer) onAgentRegistered(ev *Event) {
	if ev.Raw.FromAddress.Cmp(i.registryAddress) != 0 {
		slog.Warn("received agent registered event from non-registry address", "address", ev.Raw.FromAddress)
		return
	}

	agentRegisteredEv, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		slog.Error("failed to parse agent registered event")
		return
	}

	i.pushAgentInfo(
		agentRegisteredEv.Agent,
		agentRegisteredEv.Name,
		agentRegisteredEv.SystemPrompt,
		ev.Raw.BlockNumber,
	)
}

func (i *AgentIndexer) pushAgentInfo(addr *felt.Felt, name string, systemPrompt string, block uint64) {
	i.agentsMu.Lock()
	defer i.agentsMu.Unlock()

	info := AgentInfo{
		Address:      addr,
		Name:         name,
		SystemPrompt: systemPrompt,
	}
	i.agents[addr.Bytes()] = info
	i.addresses = append(i.addresses, addr)
}

// GetAgentInfo returns an agent's info, if it exists.
func (i *AgentIndexer) GetAgentInfo(addr *felt.Felt) (AgentInfo, bool) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	info, ok := i.agents[addr.Bytes()]
	return info, ok
}

// GetOrFetchAgentInfoAtBlock returns an agent's info if it exists.
func (i *AgentIndexer) GetOrFetchAgentInfo(ctx context.Context, addr *felt.Felt, block uint64) (AgentInfo, error) {
	i.agentsMu.RLock()
	info, ok := i.agents[addr.Bytes()]
	if !ok {
		if i.lastIndexedBlock >= block {
			return AgentInfo{}, fmt.Errorf("agent not found")
		}
	}
	defer i.agentsMu.RUnlock()

	info, err := i.fetchAgentInfo(ctx, addr)
	if err != nil {
		return AgentInfo{}, err
	}

	return info, nil
}

func (i *AgentIndexer) fetchAgentInfo(ctx context.Context, addr *felt.Felt) (AgentInfo, error) {
	if i.rateLimiter != nil {
		if err := i.rateLimiter.Wait(ctx); err != nil {
			return AgentInfo{}, fmt.Errorf("rate limit exceeded: %v", err)
		}
	}
	isAgentRegisteredResp, err := i.client.Call(ctx, rpc.FunctionCall{
		ContractAddress:    i.registryAddress,
		EntryPointSelector: isAgentRegisteredSelector,
	}, rpc.WithBlockTag("latest"))
	if err != nil {
		return AgentInfo{}, fmt.Errorf("is_agent_registered call failed: %v", snaccount.FormatRpcError(err))
	}
	if isAgentRegisteredResp[0].Cmp(new(felt.Felt).SetUint64(1)) != 0 {
		return AgentInfo{}, fmt.Errorf("agent not registered")
	}

	if i.rateLimiter != nil {
		if err := i.rateLimiter.Wait(ctx); err != nil {
			return AgentInfo{}, fmt.Errorf("rate limit exceeded: %v", err)
		}
	}
	nameResp, err := i.client.Call(ctx, rpc.FunctionCall{
		ContractAddress:    addr,
		EntryPointSelector: getNameSelector,
	}, rpc.WithBlockTag("latest"))
	if err != nil {
		return AgentInfo{}, fmt.Errorf("get_name call failed: %v", snaccount.FormatRpcError(err))
	}
	name, err := starknetgoutils.ByteArrFeltToString(nameResp)
	if err != nil {
		return AgentInfo{}, fmt.Errorf("parse get_name failed: %v", err)
	}

	getSystemPromptResp, err := i.client.Call(ctx, rpc.FunctionCall{
		ContractAddress:    addr,
		EntryPointSelector: getSystemPromptSelector,
	}, rpc.WithBlockTag("latest"))
	if err != nil {
		return AgentInfo{}, fmt.Errorf("system_prompt call failed: %v", snaccount.FormatRpcError(err))
	}
	systemPrompt, err := starknetgoutils.ByteArrFeltToString(getSystemPromptResp)
	if err != nil {
		return AgentInfo{}, fmt.Errorf("parse system_prompt failed: %v", err)
	}

	return AgentInfo{
		Address:      addr,
		Name:         name,
		SystemPrompt: systemPrompt,
	}, nil
}

// GetAllAgentAddresses returns all known agent addresses.
func (i *AgentIndexer) GetAllAgentAddresses() []*felt.Felt {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	copied := make([]*felt.Felt, len(i.addresses))
	copy(copied, i.addresses)
	return copied
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentIndexer) GetLastIndexedBlock() uint64 {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	return i.lastIndexedBlock
}

// ReadState reads the current state of the indexer.
func (i *AgentIndexer) ReadState(f func(map[[32]byte]AgentInfo, uint64)) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	f(i.agents, i.lastIndexedBlock)
}
