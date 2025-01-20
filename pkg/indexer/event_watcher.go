package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/time/rate"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type EventType int

const (
	EventAgentRegistered EventType = iota
	EventPromptPaid
	EventTransfer
	EventTokenAdded
	EventTokenRemoved
)

var EventTypeItems = []EventType{
	EventAgentRegistered,
	EventPromptPaid,
	EventTransfer,
	EventTokenAdded,
	EventTokenRemoved,
}

type Event struct {
	Type EventType
	Raw  rpc.EmittedEvent
}

type AgentRegisteredEvent struct {
	Agent        *felt.Felt
	Creator      *felt.Felt
	Name         string
	SystemPrompt string
}

func (e *Event) ToAgentRegisteredEvent() (*AgentRegisteredEvent, bool) {
	if e.Type != EventAgentRegistered {
		return nil, false
	}

	agent := e.Raw.Keys[0]
	creator := e.Raw.Keys[1]

	namePos := uint64(0)
	nameCount := e.Raw.Data[namePos].Uint64()
	nameSize := 3 + nameCount
	systemPromptPos := namePos + nameSize
	systemPromptCount := e.Raw.Data[systemPromptPos].Uint64()
	systemPromptSize := 3 + systemPromptCount

	name, err := starknetgoutils.ByteArrFeltToString(e.Raw.Data[namePos : namePos+nameSize])
	if err != nil {
		return nil, false
	}

	systemPrompt, err := starknetgoutils.ByteArrFeltToString(e.Raw.Data[systemPromptPos : systemPromptPos+systemPromptSize])
	if err != nil {
		return nil, false
	}

	return &AgentRegisteredEvent{
		Agent:        agent,
		Creator:      creator,
		Name:         name,
		SystemPrompt: systemPrompt,
	}, true
}

type PromptPaidEvent struct {
	User     *felt.Felt
	PromptID *felt.Felt
	TweetID  uint64
	Amount   *big.Int
}

func (e *Event) ToPromptPaidEvent() (*PromptPaidEvent, bool) {
	if e.Type != EventPromptPaid {
		return nil, false
	}

	user := e.Raw.Keys[1]
	promptID := e.Raw.Keys[2]
	tweetID := e.Raw.Keys[3].Uint64()

	amountLow := e.Raw.Data[0].BigInt(new(big.Int))
	amountHigh := e.Raw.Data[1].BigInt(new(big.Int))
	amount := amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)

	return &PromptPaidEvent{
		User:     user,
		PromptID: promptID,
		TweetID:  tweetID,
		Amount:   amount,
	}, true
}

type TransferEvent struct {
	From   *felt.Felt
	To     *felt.Felt
	Amount *big.Int
}

func (e *Event) ToTransferEvent() (*TransferEvent, bool) {
	if e.Type != EventTransfer {
		return nil, false
	}

	keyCount := len(e.Raw.Keys)
	dataCount := len(e.Raw.Data)

	var from *felt.Felt
	var to *felt.Felt
	var amount *big.Int

	if keyCount >= 3 {
		from = e.Raw.Keys[1]
		to = e.Raw.Keys[2]

		if dataCount == 1 {
			amount = e.Raw.Data[0].BigInt(new(big.Int))
		} else if dataCount == 2 {
			amountLow := e.Raw.Data[0].BigInt(new(big.Int))
			amountHigh := e.Raw.Data[1].BigInt(new(big.Int))
			amount = amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
		} else if keyCount == 4 {
			amount = e.Raw.Keys[3].BigInt(new(big.Int))
		} else if keyCount == 5 {
			amountLow := e.Raw.Keys[3].BigInt(new(big.Int))
			amountHigh := e.Raw.Keys[4].BigInt(new(big.Int))
			amount = amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
		}
	} else if dataCount >= 3 {
		from = e.Raw.Data[0]
		to = e.Raw.Data[1]

		if dataCount == 3 {
			amount = e.Raw.Data[2].BigInt(new(big.Int))
		} else if dataCount == 4 {
			amountLow := e.Raw.Data[2].BigInt(new(big.Int))
			amountHigh := e.Raw.Data[3].BigInt(new(big.Int))
			amount = amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)
		}
	} else {
		slog.Warn("invalid transfer event", "txHash", e.Raw.TransactionHash)
		return nil, false
	}

	return &TransferEvent{
		From:   from,
		To:     to,
		Amount: amount,
	}, true
}

type TokenAddedEvent struct {
	Token          *felt.Felt
	MinPromptPrice *big.Int
}

func (e *Event) ToTokenAddedEvent() (*TokenAddedEvent, bool) {
	if e.Type != EventTokenAdded {
		return nil, false
	}

	if len(e.Raw.Keys) != 2 {
		slog.Warn("invalid token added event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) != 2 {
		slog.Warn("invalid token added event", "data", e.Raw.Data)
		return nil, false
	}

	token := e.Raw.Keys[1]

	amountLow := e.Raw.Data[0].BigInt(new(big.Int))
	amountHigh := e.Raw.Data[1].BigInt(new(big.Int))
	minPromptPrice := amountHigh.Lsh(amountHigh, 128).Add(amountHigh, amountLow)

	return &TokenAddedEvent{
		Token:          token,
		MinPromptPrice: minPromptPrice,
	}, true
}

type TokenRemovedEvent struct {
	Token *felt.Felt
}

func (e *Event) ToTokenRemovedEvent() (*TokenRemovedEvent, bool) {
	if e.Type != EventTokenRemoved {
		return nil, false
	}

	if len(e.Raw.Keys) != 2 {
		slog.Warn("invalid token removed event", "keys", e.Raw.Keys)
		return nil, false
	}

	token := e.Raw.Keys[1]

	return &TokenRemovedEvent{
		Token: token,
	}, true
}

type EventSubscriptionData struct {
	Events    []*Event
	FromBlock uint64
	ToBlock   uint64
}

// EventSubscriberConfig holds the necessary settings for constructing an EventSubscriber.
type EventSubscriberConfig struct {
	Type EventType
}

// EventSubscriber is a write-only channel to receive parsed Events.
type EventSubscriber struct {
	id  int64
	typ EventType
	ch  chan<- *EventSubscriptionData
}

// EventWatcherInitialState holds the initial state of the EventWatcher.
type EventWatcherInitialState struct {
	LastIndexedBlock uint64
}

// EventWatcherConfig holds the necessary settings for constructing an EventWatcher.
type EventWatcherConfig struct {
	Client          *rpc.Provider
	SafeBlockDelta  uint64
	TickRate        time.Duration
	IndexChunkSize  uint
	RegistryAddress *felt.Felt
	RateLimiter     *rate.Limiter
	InitialState    *EventWatcherInitialState
}

// EventWatcher fetches events from Starknet in block ranges, parses them, and
// distributes them to subscribers (AgentRegistered, Transfer, PromptPaid, etc.).
type EventWatcher struct {
	client           *rpc.Provider
	lastIndexedBlock uint64
	safeBlockDelta   uint64
	tickRate         time.Duration
	indexChunkSize   uint
	rateLimiter      *rate.Limiter

	// Subscribers for specific event types
	mu        sync.RWMutex
	subs      map[EventType][]*EventSubscriber
	nextSubID int64
}

// NewEventWatcher initializes a new EventWatcher.
func NewEventWatcher(cfg *EventWatcherConfig) *EventWatcher {
	if cfg.InitialState == nil {
		cfg.InitialState = &EventWatcherInitialState{
			LastIndexedBlock: 0,
		}
	}

	return &EventWatcher{
		client:           cfg.Client,
		lastIndexedBlock: cfg.InitialState.LastIndexedBlock,
		safeBlockDelta:   cfg.SafeBlockDelta,
		tickRate:         cfg.TickRate,
		indexChunkSize:   cfg.IndexChunkSize,
		subs:             make(map[EventType][]*EventSubscriber),
	}
}

// Subscribe registers a subscriber for events and returns a subscription ID that can be used to unsubscribe.
func (w *EventWatcher) Subscribe(typ EventType, ch chan<- *EventSubscriptionData) int64 {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.nextSubID++
	id := w.nextSubID

	subscriber := EventSubscriber{
		id:  id,
		typ: typ,
		ch:  ch,
	}

	w.subs[typ] = append(w.subs[typ], &subscriber)
	return id
}

// Unsubscribe removes a subscriber by its subscription ID.
func (w *EventWatcher) Unsubscribe(id int64) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	for typ, subscribers := range w.subs {
		for i, sub := range subscribers {
			if sub.id == id {
				// Remove subscriber by swapping with last element and truncating
				lastIdx := len(subscribers) - 1
				subscribers[i] = subscribers[lastIdx]
				w.subs[typ] = subscribers[:lastIdx]
				return true
			}
		}
	}
	return false
}

// Run starts the main indexing loop in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (w *EventWatcher) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return w.run(ctx)
	})
	return g.Wait()
}

func (w *EventWatcher) run(ctx context.Context) error {
	slog.Info("starting EventWatcher")
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(w.tickRate):
			if err := w.indexBlocks(ctx); err != nil {
				slog.Error("indexBlocks failed", "error", err)
				// continue attempting on next tick
			}
		}
	}
}

// indexBlocks fetches blocks ranging from (lastIndexedBlock+1) to safeBlock in chunks, then parses events.
func (w *EventWatcher) indexBlocks(ctx context.Context) error {
	currentBlock, err := w.client.BlockNumber(ctx)
	if err != nil {
		snaccount.LogRpcError(err)
		return fmt.Errorf("failed to get current block number: %v", err)
	}

	safeBlock := currentBlock - w.safeBlockDelta
	if safeBlock <= w.lastIndexedBlock {
		return nil
	}

	for from := w.lastIndexedBlock + 1; from <= safeBlock; from += uint64(w.indexChunkSize) {
		toBlock := from + uint64(w.indexChunkSize) - 1
		if toBlock > safeBlock {
			toBlock = safeBlock
		}

		slog.Info("processing block chunk", "fromBlock", from, "toBlock", toBlock)

		if w.rateLimiter != nil {
			if err := w.rateLimiter.Wait(ctx); err != nil {
				return fmt.Errorf("rate limit exceeded: %v", err)
			}
		}

		// Gather events for these blocks from the node
		eventsResp, err := w.client.Events(ctx, rpc.EventsInput{
			EventFilter: rpc.EventFilter{
				FromBlock: rpc.WithBlockNumber(from),
				ToBlock:   rpc.WithBlockNumber(toBlock),
				// We'll fetch all possible keys of interest in a single request:
				Keys: [][]*felt.Felt{
					{
						agentRegisteredSelector,
						promptPaidSelector,
						transferSelector,
						tokenAddedSelector,
						tokenRemovedSelector,
					},
				},
			},
			ResultPageRequest: rpc.ResultPageRequest{
				ChunkSize: int(w.indexChunkSize),
			},
		})
		if err != nil {
			snaccount.LogRpcError(err)
			return fmt.Errorf("failed to get events from %v to %v: %v", from, toBlock, err)
		}

		evs := make(map[EventType][]*Event, len(EventTypeItems))

		// Parse each event into our local struct and broadcast.
		for _, rawEvent := range eventsResp.Events {
			parsedEvt, ok := w.parseEvent(rawEvent)
			if ok {
				evs[parsedEvt.Type] = append(evs[parsedEvt.Type], &parsedEvt)
			}
		}

		w.broadcast(evs, from, toBlock)

		w.mu.Lock()
		w.lastIndexedBlock = toBlock
		w.mu.Unlock()

		slog.Info("finished chunk", "lastIndexedBlock", w.lastIndexedBlock)
	}

	slog.Info("finished indexing events up to", "block", w.lastIndexedBlock)
	return nil
}

// parseEvent examines the raw keys/data to determine the event type and produce an Event struct.
func (w *EventWatcher) parseEvent(raw rpc.EmittedEvent) (Event, bool) {
	// The first key is the event selector
	selector := raw.Keys[0]
	ev := Event{
		Raw: raw,
	}
	switch {
	case selector.Cmp(agentRegisteredSelector) == 0:
		slog.Debug("parsed agent registered event")
		ev.Type = EventAgentRegistered
		return ev, true
	case selector.Cmp(transferSelector) == 0:
		slog.Debug("parsed transfer event")
		ev.Type = EventTransfer
		return ev, true
	case selector.Cmp(promptPaidSelector) == 0:
		slog.Debug("parsed prompt paid event")
		ev.Type = EventPromptPaid
		return ev, true
	case selector.Cmp(tokenAddedSelector) == 0:
		slog.Debug("parsed token added event")
		ev.Type = EventTokenAdded
		return ev, true
	case selector.Cmp(tokenRemovedSelector) == 0:
		slog.Debug("parsed token removed event")
		ev.Type = EventTokenRemoved
		return ev, true
	default:
		slog.Debug("parsed unknown event")
		return Event{}, false
	}
}

// broadcast routes the parsed events to the correct set of subscribers.
func (w *EventWatcher) broadcast(evs map[EventType][]*Event, fromBlock uint64, toBlock uint64) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	for evType, evList := range evs {
		for _, sub := range w.subs[evType] {
			sub.ch <- &EventSubscriptionData{
				Events:    evList,
				FromBlock: fromBlock,
				ToBlock:   toBlock,
			}
		}
	}
}

// ReadState reads the current state of the watcher.
func (w *EventWatcher) ReadState(f func(uint64)) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	f(w.lastIndexedBlock)
}
