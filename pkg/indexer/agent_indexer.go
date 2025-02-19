package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
	"golang.org/x/sync/errgroup"
)

type AgentInfo struct {
	Address      *felt.Felt
	Creator      *felt.Felt
	Name         string
	SystemPrompt string
	PromptPrice  *big.Int
	TokenAddress *felt.Felt
	EndTime      uint64
	Model        *felt.Felt
}

// AgentIndexer processes AgentRegistered events and tracks known agents.
type AgentIndexer struct {
	agentsMu        sync.RWMutex
	db              AgentIndexerDatabase
	registryAddress *felt.Felt
	client          starknet.ProviderWrapper

	eventCh      chan *EventSubscriptionData
	eventSubID   int64
	eventWatcher *EventWatcher
}

// AgentIndexerInitialState is the initial state for an AgentIndexer.
type AgentIndexerInitialState struct {
	Db AgentIndexerDatabase
}

// AgentIndexerConfig is the configuration for an AgentIndexer.
type AgentIndexerConfig struct {
	RegistryAddress *felt.Felt
	Client          starknet.ProviderWrapper
	InitialState    *AgentIndexerInitialState
	EventWatcher    *EventWatcher
}

// NewAgentIndexer instantiates an AgentIndexer.
func NewAgentIndexer(cfg *AgentIndexerConfig) *AgentIndexer {
	if cfg.InitialState == nil {
		cfg.InitialState = &AgentIndexerInitialState{
			Db: NewAgentIndexerDatabaseInMemory(0),
		}
	}

	eventCh := make(chan *EventSubscriptionData, 1000)
	eventSubID := cfg.EventWatcher.Subscribe(EventAgentRegistered, eventCh)

	return &AgentIndexer{
		db:              cfg.InitialState.Db,
		registryAddress: cfg.RegistryAddress,
		client:          cfg.Client,
		eventCh:         eventCh,
		eventSubID:      eventSubID,
		eventWatcher:    cfg.EventWatcher,
	}
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (i *AgentIndexer) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return i.run(ctx)
	})
	return g.Wait()
}

func (i *AgentIndexer) run(ctx context.Context) error {
	defer i.eventWatcher.Unsubscribe(i.eventSubID)

	for {
		select {
		case data := <-i.eventCh:
			i.agentsMu.Lock()
			for _, ev := range data.Events {
				i.onAgentRegistered(ev)
			}
			if err := i.db.SetLastIndexedBlock(data.ToBlock); err != nil {
				slog.Error("failed to set last indexed block", "error", err)
			}
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

	slog.Info(
		"agent registered",
		"address", agentRegisteredEv.Agent.String(),
		"creator", agentRegisteredEv.Creator.String(),
		"name", agentRegisteredEv.Name,
		"system_prompt", agentRegisteredEv.SystemPrompt,
		"prompt_price", agentRegisteredEv.PromptPrice,
		"token_address", agentRegisteredEv.TokenAddress.String(),
		"end_time", agentRegisteredEv.EndTime,
		"model", agentRegisteredEv.Model.String(),
	)

	if err := i.db.SetAgentInfo(agentRegisteredEv.Agent.Bytes(), AgentInfo{
		Address:      agentRegisteredEv.Agent,
		Creator:      agentRegisteredEv.Creator,
		Name:         agentRegisteredEv.Name,
		SystemPrompt: agentRegisteredEv.SystemPrompt,
		PromptPrice:  agentRegisteredEv.PromptPrice,
		TokenAddress: agentRegisteredEv.TokenAddress,
		EndTime:      agentRegisteredEv.EndTime,
		Model:        agentRegisteredEv.Model,
	}); err != nil {
		slog.Error("failed to set agent info", "error", err)
	}
}

// GetAgentInfo returns an agent's info, if it exists.
func (i *AgentIndexer) GetAgentInfo(addr *felt.Felt) (AgentInfo, bool) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	info, ok := i.db.GetAgentInfo(addr.Bytes())
	return info, ok
}

// AgentsByCreatorResult is the result of a GetAgentsByCreator call.
type AgentsByCreatorResult struct {
	Agents     []AgentInfo
	AgentCount uint64
	LastBlock  uint64
}

// GetAgentsByCreator returns a list of agent addresses created by the given creator address
// within the specified range. start and limit define the pagination window.
func (i *AgentIndexer) GetAgentsByCreator(ctx context.Context, creator *felt.Felt, start uint64, limit uint64) (*AgentsByCreatorResult, bool) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	agents := i.db.GetAddressesByCreator(creator.Bytes())
	if uint64(len(agents)) <= start {
		return nil, false
	}

	end := start + limit
	if end > uint64(len(agents)) {
		end = uint64(len(agents))
	}

	agentInfos := make([]AgentInfo, end-start)
	for idx, addr := range agents[start:end] {
		var ok bool
		agentInfos[idx], ok = i.db.GetAgentInfo(addr)

		if !ok {
			slog.Error("agent not found", "address", addr)
		}
	}

	return &AgentsByCreatorResult{
		Agents:     agentInfos,
		AgentCount: uint64(len(agents)),
		LastBlock:  i.db.GetLastIndexedBlock(),
	}, true
}

// GetOrFetchAgentInfoAtBlock returns an agent's info if it exists.
func (i *AgentIndexer) GetOrFetchAgentInfo(ctx context.Context, addr *felt.Felt, block uint64) (AgentInfo, error) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	info, ok := i.db.GetAgentInfo(addr.Bytes())
	if !ok {
		if i.db.GetLastIndexedBlock() >= block {
			return AgentInfo{}, fmt.Errorf("agent not found")
		}

		info, err := i.fetchAgentInfo(ctx, addr)
		if err != nil {
			return AgentInfo{}, err
		}

		return info, nil
	}

	return info, nil
}

func (i *AgentIndexer) fetchAgentInfo(ctx context.Context, addr *felt.Felt) (AgentInfo, error) {
	var isAgentRegisteredResp []*felt.Felt
	var err error

	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		isAgentRegisteredResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    i.registryAddress,
			EntryPointSelector: isAgentRegisteredSelector,
			Calldata:           []*felt.Felt{addr},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("is_agent_registered call failed: %w", snaccount.FormatRpcError(err))
	}

	if isAgentRegisteredResp[0].Cmp(new(felt.Felt).SetUint64(1)) != 0 {
		return AgentInfo{}, fmt.Errorf("agent not registered")
	}

	var nameResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		nameResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getNameSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("get_name call failed: %w", snaccount.FormatRpcError(err))
	}

	name, err := starknet.ByteArrFeltToString(nameResp)
	if err != nil {
		return AgentInfo{}, fmt.Errorf("parse get_name failed: %v", err)
	}

	var getSystemPromptResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		getSystemPromptResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getSystemPromptSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("system_prompt call failed: %w", snaccount.FormatRpcError(err))
	}

	systemPrompt, err := starknet.ByteArrFeltToString(getSystemPromptResp)
	if err != nil {
		return AgentInfo{}, fmt.Errorf("parse system_prompt failed: %v", err)
	}

	var getCreatorResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		getCreatorResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getCreatorSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("get_creator call failed: %w", snaccount.FormatRpcError(err))
	}

	var getPromptPriceResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		getPromptPriceResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getPromptPriceSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("get_prompt_price call failed: %w", snaccount.FormatRpcError(err))
	}

	var getTokenResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		getTokenResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getTokenSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("get_token call failed: %w", snaccount.FormatRpcError(err))
	}

	var getEndTimeResp []*felt.Felt
	if err := i.client.Do(func(provider rpc.RpcProvider) error {
		getEndTimeResp, err = provider.Call(ctx, rpc.FunctionCall{
			ContractAddress:    addr,
			EntryPointSelector: getEndTimeSelector,
			Calldata:           []*felt.Felt{},
		}, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return AgentInfo{}, fmt.Errorf("get_end_time call failed: %w", snaccount.FormatRpcError(err))
	}

	promptPrice := snaccount.Uint256ToBigInt([2]*felt.Felt(getPromptPriceResp[0:2]))

	return AgentInfo{
		Address:      addr,
		Creator:      getCreatorResp[0],
		Name:         name,
		SystemPrompt: systemPrompt,
		PromptPrice:  promptPrice,
		TokenAddress: getTokenResp[0],
		EndTime:      getEndTimeResp[0].Uint64(),
	}, nil
}

// GetLastIndexedBlock returns the last indexed block.
func (i *AgentIndexer) GetLastIndexedBlock() uint64 {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	return i.db.GetLastIndexedBlock()
}

// ReadState reads the current state of the indexer.
func (i *AgentIndexer) ReadState(f func(AgentIndexerDatabaseReader)) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	f(i.db)
}

type AgentInfosByNamePrefixResult struct {
	AgentInfos []*AgentInfo
	Total      uint64
	LastBlock  uint64
}

// GetAgentInfosByNamePrefix returns a list of agent infos by name prefix.
func (i *AgentIndexer) GetAgentInfosByNamePrefix(namePrefix string, offset uint64, limit uint64) (*AgentInfosByNamePrefixResult, bool) {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	agentInfos, total, ok := i.db.GetAgentInfosByName(namePrefix, offset, limit)
	if !ok {
		return nil, false
	}

	return &AgentInfosByNamePrefixResult{
		AgentInfos: agentInfos,
		Total:      total,
		LastBlock:  i.db.GetLastIndexedBlock(),
	}, true
}
