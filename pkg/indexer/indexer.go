package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

const (
	indexingEventChunkSize   = 1000
	initializeAgentInfoLimit = 3
	initializeAgentInfoBurst = 3
)

var (
	promptPaidSelector      = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
	agentRegisteredSelector = starknetgoutils.GetSelectorFromNameFelt("AgentRegistered")

	getSystemPromptSelector = starknetgoutils.GetSelectorFromNameFelt("get_system_prompt")
	getPromptPriceSelector  = starknetgoutils.GetSelectorFromNameFelt("get_prompt_price")
	getTokenSelector        = starknetgoutils.GetSelectorFromNameFelt("get_token")
)

type PromptPaidEvent struct {
	AgentAddress *felt.Felt
	FromAddress  *felt.Felt
	TweetID      uint64
}

type AgentInfo struct {
	Address *felt.Felt
	Creator *felt.Felt
	Name    *felt.Felt

	Initialized  bool
	SystemPrompt string
	PromptPrice  *felt.Felt
	Token        *felt.Felt
}

type Indexer struct {
	client          *rpc.Provider
	lastBlockNumber uint64
	safeBlockDelta  uint64
	tickRate        time.Duration
	registryAddress *felt.Felt

	agents         map[[32]byte]AgentInfo
	agentAddresses []*felt.Felt
	agentsMu       sync.RWMutex

	initializeAgentInfoGroup   singleflight.Group
	initializeAgentInfoLimiter *rate.Limiter
}

type IndexerConfig struct {
	Client          *rpc.Provider
	SafeBlockDelta  uint64
	TickRate        time.Duration
	RegistryAddress *felt.Felt
}

func NewIndexer(config *IndexerConfig) *Indexer {
	return &Indexer{
		client:                     config.Client,
		safeBlockDelta:             config.SafeBlockDelta,
		tickRate:                   config.TickRate,
		registryAddress:            config.RegistryAddress,
		agents:                     make(map[[32]byte]AgentInfo),
		initializeAgentInfoLimiter: rate.NewLimiter(rate.Limit(initializeAgentInfoLimit), initializeAgentInfoBurst),
	}
}

func (i *Indexer) GetAgentInfo(ctx context.Context, address *felt.Felt) (AgentInfo, error) {
	return i.initializeAgentInfo(ctx, address)
}

func (i *Indexer) GetAgentAddress(idx uint64) *felt.Felt {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	return i.agentAddresses[idx]
}

func (i *Indexer) GetAgentCount() uint64 {
	i.agentsMu.RLock()
	defer i.agentsMu.RUnlock()

	return uint64(len(i.agentAddresses))
}

func (i *Indexer) GetLastBlockNumber() uint64 {
	return i.lastBlockNumber
}

func (i *Indexer) pushAgentInfo(address *felt.Felt, name *felt.Felt, creator *felt.Felt) {
	i.agentsMu.Lock()
	i.agents[address.Bytes()] = AgentInfo{
		Address: address,
		Creator: creator,
		Name:    name,

		Initialized: false,
	}
	i.agentAddresses = append(i.agentAddresses, address)
	i.agentsMu.Unlock()
}

func (i *Indexer) initializeAgentInfo(ctx context.Context, address *felt.Felt) (AgentInfo, error) {
	v, err, _ := i.initializeAgentInfoGroup.Do(address.String(), func() (interface{}, error) {
		i.agentsMu.RLock()
		info, exists := i.agents[address.Bytes()]
		i.agentsMu.RUnlock()

		if !exists {
			return AgentInfo{}, fmt.Errorf("agent not found")
		}

		if info.Initialized {
			return info, nil
		}

		err := i.initializeAgentInfoLimiter.Wait(ctx)
		if err != nil {
			return AgentInfo{}, fmt.Errorf("rate limit wait failed: %v", err)
		}

		systemPromptCall := rpc.FunctionCall{
			ContractAddress:    address,
			EntryPointSelector: getSystemPromptSelector,
		}
		systemPromptResp, err := i.client.Call(ctx, systemPromptCall, rpc.WithBlockTag("latest"))
		if err != nil {
			snaccount.LogRpcError(err)
			return info, fmt.Errorf("failed to get system prompt: %v", err)
		}
		systemPrompt, err := starknetgoutils.ByteArrFeltToString(systemPromptResp)
		if err != nil {
			return info, fmt.Errorf("failed to convert system prompt: %v", err)
		}

		promptPriceCall := rpc.FunctionCall{
			ContractAddress:    address,
			EntryPointSelector: getPromptPriceSelector,
		}
		promptPriceResp, err := i.client.Call(ctx, promptPriceCall, rpc.WithBlockTag("latest"))
		if err != nil {
			snaccount.LogRpcError(err)
			return info, fmt.Errorf("failed to get prompt price: %v", err)
		}
		if len(promptPriceResp) != 1 {
			return info, fmt.Errorf("unexpected prompt price response length")
		}

		tokenCall := rpc.FunctionCall{
			ContractAddress:    address,
			EntryPointSelector: getTokenSelector,
		}
		tokenResp, err := i.client.Call(ctx, tokenCall, rpc.WithBlockTag("latest"))
		if err != nil {
			snaccount.LogRpcError(err)
			return info, fmt.Errorf("failed to get token: %v", err)
		}
		if len(tokenResp) != 1 {
			return info, fmt.Errorf("unexpected token response length")
		}

		info.SystemPrompt = systemPrompt
		info.PromptPrice = promptPriceResp[0]
		info.Token = tokenResp[0]
		info.Initialized = true

		i.agentsMu.Lock()
		i.agents[address.Bytes()] = info
		i.agentsMu.Unlock()

		return info, nil
	})

	if err != nil {
		return AgentInfo{}, err
	}

	return v.(AgentInfo), nil
}

// Start begins indexing events and sends them to the provided channel
func (i *Indexer) Start(ctx context.Context, promptPaidEventChan chan<- PromptPaidEvent) error {
	slog.Info("initializing existing agents")
	if err := i.indexEvents(ctx, nil); err != nil {
		return fmt.Errorf("failed to initialize existing agents: %v", err)
	}

	go func() {
		ticker := time.NewTicker(i.tickRate)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := i.indexEvents(ctx, promptPaidEventChan); err != nil {
					slog.Error("failed to index events", "error", err)
					continue
				}
			}
		}
	}()

	return nil
}

func (i *Indexer) indexEvents(ctx context.Context, promptPaidEventChan chan<- PromptPaidEvent) error {
	currentBlock, err := i.client.BlockNumber(ctx)
	if err != nil {
		snaccount.LogRpcError(err)
		slog.Error("failed to get current block number", "error", err)
		return err
	}

	slog.Info("indexing events", "fromBlock", i.lastBlockNumber+1, "toBlock", currentBlock)

	safeBlock := currentBlock - i.safeBlockDelta
	if safeBlock <= i.lastBlockNumber {
		return nil
	}

	for fromBlock := i.lastBlockNumber + 1; fromBlock <= safeBlock; fromBlock += indexingEventChunkSize {
		toBlock := fromBlock + indexingEventChunkSize - 1
		if toBlock > safeBlock {
			toBlock = safeBlock
		}

		slog.Info("processing block chunk", "fromBlock", fromBlock, "toBlock", toBlock)

		allEvents, err := i.client.Events(ctx, rpc.EventsInput{
			EventFilter: rpc.EventFilter{
				FromBlock: rpc.WithBlockNumber(fromBlock),
				ToBlock:   rpc.WithBlockNumber(toBlock),
				Keys: [][]*felt.Felt{
					{agentRegisteredSelector},
					{promptPaidSelector},
				},
			},
			ResultPageRequest: rpc.ResultPageRequest{
				ChunkSize: indexingEventChunkSize,
			},
		})
		if err != nil {
			snaccount.LogRpcError(err)
			return fmt.Errorf("failed to get events: %v", err)
		}

		for _, event := range allEvents.Events {
			isEventFromRegistry := event.FromAddress.Cmp(i.registryAddress) == 0
			isAgentRegisteredEvent := event.Keys[0].Cmp(agentRegisteredSelector) == 0

			if isEventFromRegistry && isAgentRegisteredEvent {
				agentAddress := event.Data[0]

				i.pushAgentInfo(agentAddress, event.Keys[1], event.Keys[2])

				go func(addr *felt.Felt) {
					if _, err := i.initializeAgentInfo(ctx, addr); err != nil {
						slog.Error("failed to fetch agent info", "error", err, "agent", addr)
					}
				}(agentAddress)
			}
		}

		if promptPaidEventChan != nil {
			for _, event := range allEvents.Events {
				if parsed, ok := i.parseEvent(event); ok {
					select {
					case <-ctx.Done():
						return ctx.Err()
					case promptPaidEventChan <- parsed:
					}
				}
			}
		}

		i.lastBlockNumber = toBlock
	}

	slog.Info("finished indexing events", "lastIndexedBlock", safeBlock)
	return nil
}

func (i *Indexer) parseEvent(event rpc.EmittedEvent) (PromptPaidEvent, bool) {
	if event.Keys[0].Cmp(promptPaidSelector) != 0 {
		return PromptPaidEvent{}, false
	}

	agentAddress := event.FromAddress

	i.agentsMu.RLock()
	_, exists := i.agents[agentAddress.Bytes()]
	i.agentsMu.RUnlock()
	if !exists {
		return PromptPaidEvent{}, false
	}

	fromAddress := event.Keys[1]
	tweetIDKey := event.Keys[3]
	tweetID := tweetIDKey.Uint64()

	if tweetIDKey.Cmp(new(felt.Felt).SetUint64(tweetID)) != 0 {
		slog.Warn("twitter message ID overflow")
		return PromptPaidEvent{}, false
	}

	return PromptPaidEvent{
		FromAddress:  fromAddress,
		AgentAddress: agentAddress,
		TweetID:      tweetID,
	}, true
}
