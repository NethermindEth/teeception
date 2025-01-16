package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
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

	balanceUpdateLimit = 10
	balanceUpdateBurst = 10
)

var (
	promptPaidSelector      = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
	agentRegisteredSelector = starknetgoutils.GetSelectorFromNameFelt("AgentRegistered")
	transferSelector        = starknetgoutils.GetSelectorFromNameFelt("Transfer")

	getSystemPromptSelector = starknetgoutils.GetSelectorFromNameFelt("get_system_prompt")
	getPromptPriceSelector  = starknetgoutils.GetSelectorFromNameFelt("get_prompt_price")
	getTokenSelector        = starknetgoutils.GetSelectorFromNameFelt("get_token")

	balanceOfSelector = starknetgoutils.GetSelectorFromNameFelt("balanceOf")
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

	BalanceUpdatedAt uint64
	Balance          *big.Int
}

type Indexer struct {
	client          *rpc.Provider
	lastBlockNumber uint64
	safeBlockDelta  uint64
	tickRate        time.Duration
	registryAddress *felt.Felt

	agents         map[[32]byte]AgentInfo
	agentAddresses []*felt.Felt
	tokenFromAgent map[[32]byte]map[[32]byte]bool
	agentsMu       sync.RWMutex

	disableBalanceUpdates bool
	balanceUpdateRate     time.Duration
	balanceUpdateSet      map[string]struct{}
	balanceUpdateSetMu    sync.Mutex
	balanceUpdateLimiter  *rate.Limiter

	initializeAgentInfoGroup   singleflight.Group
	initializeAgentInfoLimiter *rate.Limiter
}

type IndexerConfig struct {
	Client                *rpc.Provider
	SafeBlockDelta        uint64
	TickRate              time.Duration
	BalanceUpdateRate     time.Duration
	RegistryAddress       *felt.Felt
	DisableBalanceUpdates bool
}

func NewIndexer(config *IndexerConfig) *Indexer {
	return &Indexer{
		client:                     config.Client,
		safeBlockDelta:             config.SafeBlockDelta,
		tickRate:                   config.TickRate,
		registryAddress:            config.RegistryAddress,
		agents:                     make(map[[32]byte]AgentInfo),
		tokenFromAgent:             make(map[[32]byte]map[[32]byte]bool),
		disableBalanceUpdates:      config.DisableBalanceUpdates,
		balanceUpdateRate:          config.BalanceUpdateRate,
		balanceUpdateSet:           make(map[string]struct{}),
		balanceUpdateLimiter:       rate.NewLimiter(rate.Limit(balanceUpdateLimit), balanceUpdateBurst),
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
		Balance:     big.NewInt(0),
	}
	i.agentAddresses = append(i.agentAddresses, address)
	i.agentsMu.Unlock()

	i.balanceUpdateSetMu.Lock()
	i.balanceUpdateSet[address.String()] = struct{}{}
	i.balanceUpdateSetMu.Unlock()
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
		if _, exists := i.tokenFromAgent[info.Token.Bytes()]; !exists {
			i.tokenFromAgent[info.Token.Bytes()] = make(map[[32]byte]bool)
		}
		i.tokenFromAgent[info.Token.Bytes()][address.Bytes()] = true
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

	if !i.disableBalanceUpdates {
		go i.balanceUpdateTask(ctx)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(i.tickRate):
				if err := i.indexEvents(ctx, promptPaidEventChan); err != nil {
					slog.Error("failed to index events", "error", err)
					continue
				}
			}
		}
	}()

	return nil
}

func (i *Indexer) balanceUpdateTask(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(i.balanceUpdateRate):
			currentBlock, err := i.client.BlockNumber(ctx)
			if err != nil {
				slog.Error("failed to get current block for balance updates", "error", err)
				continue
			}

			safeBlock := currentBlock - i.safeBlockDelta
			slog.Info("updating balances", "block", safeBlock)

			// Get current set of addresses to update and reset
			i.balanceUpdateSetMu.Lock()
			addressesToUpdate := i.balanceUpdateSet
			i.balanceUpdateSet = make(map[string]struct{})
			i.balanceUpdateSetMu.Unlock()

			// Process all addresses in the set
			for addrStr := range addressesToUpdate {
				address, err := new(felt.Felt).SetString(addrStr)
				if err != nil {
					slog.Error("failed to parse address", "error", err, "address", addrStr)
					continue
				}

				if err := i.updateAgentBalance(ctx, address, safeBlock); err != nil {
					slog.Error("failed to update agent balance", "error", err, "agent", address)
				}
			}
		}
	}
}

func (i *Indexer) updateAgentBalance(ctx context.Context, address *felt.Felt, blockNumber uint64) error {
	if err := i.balanceUpdateLimiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limit wait failed: %v", err)
	}

	i.agentsMu.RLock()
	info, exists := i.agents[address.Bytes()]
	i.agentsMu.RUnlock()

	if !exists || !info.Initialized {
		return fmt.Errorf("agent not initialized")
	}

	balanceCall := rpc.FunctionCall{
		ContractAddress:    info.Token,
		EntryPointSelector: balanceOfSelector,
		Calldata:           []*felt.Felt{address},
	}

	balanceResp, err := i.client.Call(ctx, balanceCall, rpc.WithBlockNumber(blockNumber))
	if err != nil {
		snaccount.LogRpcError(err)
		return fmt.Errorf("failed to get balance: %v", err)
	}

	if len(balanceResp) != 1 {
		return fmt.Errorf("unexpected balance response length")
	}

	i.agentsMu.Lock()
	info.Balance = balanceResp[0].BigInt(big.NewInt(0))
	info.BalanceUpdatedAt = blockNumber
	i.agents[address.Bytes()] = info
	i.agentsMu.Unlock()

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
					{transferSelector},
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
			isTransferEvent := event.Keys[0].Cmp(transferSelector) == 0

			if isEventFromRegistry && isAgentRegisteredEvent {
				agentAddress := event.Data[0]

				i.pushAgentInfo(agentAddress, event.Keys[1], event.Keys[2])

				go func(addr *felt.Felt) {
					if _, err := i.initializeAgentInfo(ctx, addr); err != nil {
						slog.Error("failed to fetch agent info", "error", err, "agent", addr)
					}
				}(agentAddress)
			} else if isTransferEvent && !i.disableBalanceUpdates {
				tokenAddress := event.FromAddress
				fromAddress := event.Keys[1]
				toAddress := event.Keys[2]

				// Queue balance updates for agents involved in transfers
				if _, exists := i.tokenFromAgent[tokenAddress.Bytes()][toAddress.Bytes()]; exists {
					i.balanceUpdateSetMu.Lock()
					i.balanceUpdateSet[toAddress.String()] = struct{}{}
					i.balanceUpdateSetMu.Unlock()
				}

				if _, exists := i.tokenFromAgent[tokenAddress.Bytes()][fromAddress.Bytes()]; exists {
					i.balanceUpdateSetMu.Lock()
					i.balanceUpdateSet[fromAddress.String()] = struct{}{}
					i.balanceUpdateSetMu.Unlock()
				}
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
