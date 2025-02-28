package indexer

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	lru "github.com/hashicorp/golang-lru/v2"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/teeception/backend/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/backend/pkg/wallet/starknet"
)

type EventType int

const (
	EventAgentRegistered EventType = 1 << iota
	EventPromptPaid
	EventPromptConsumed
	EventDrained
	EventWithdrawn
	EventTransfer
	EventTokenAdded
	EventTokenRemoved
	EventTeeUnencumbered
)

const (
	MinimumSizeSelector  = 1
	MinimumSizeFelt252   = 1
	MinimumSizeUint64    = 1
	MinimumSizeUint256   = 2
	MinimumSizeByteArray = 3
)

var (
	EventItems = []struct {
		SelectorBytes [32]byte
		Type          EventType
	}{
		{agentRegisteredSelectorBytes, EventAgentRegistered},
		{promptPaidSelectorBytes, EventPromptPaid},
		{promptConsumedSelectorBytes, EventPromptConsumed},
		{drainedSelectorBytes, EventDrained},
		{withdrawnSelectorBytes, EventWithdrawn},
		{transferSelectorBytes, EventTransfer},
		{tokenAddedSelectorBytes, EventTokenAdded},
		{tokenRemovedSelectorBytes, EventTokenRemoved},
		{teeUnencumberedSelectorBytes, EventTeeUnencumbered},
	}

	EventSelectors = []*felt.Felt{
		agentRegisteredSelector,
		promptPaidSelector,
		promptConsumedSelector,
		drainedSelector,
		withdrawnSelector,
		transferSelector,
		tokenAddedSelector,
		tokenRemovedSelector,
		teeUnencumberedSelector,
	}
)

type Event struct {
	Type EventType
	Raw  rpc.EmittedEvent
}

type AgentRegisteredEvent struct {
	Agent        *felt.Felt
	Creator      *felt.Felt
	PromptPrice  *big.Int
	TokenAddress *felt.Felt
	EndTime      uint64
	Model        *felt.Felt
	Name         string
	SystemPrompt string
}

const (
	AgentRegisteredEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252 +
		MinimumSizeFelt252

	AgentRegisteredEventDataMinimumSize = 0 +
		MinimumSizeUint256 +
		MinimumSizeFelt252 +
		MinimumSizeUint64 +
		MinimumSizeFelt252 +
		MinimumSizeByteArray +
		MinimumSizeByteArray
)

func (e *Event) ToAgentRegisteredEvent() (*AgentRegisteredEvent, bool) {
	if e.Type != EventAgentRegistered {
		return nil, false
	}

	if len(e.Raw.Keys) < AgentRegisteredEventKeysMinimumSize {
		slog.Warn("invalid agent registered event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) < AgentRegisteredEventDataMinimumSize {
		slog.Warn("invalid agent registered event", "data", e.Raw.Data)
		return nil, false
	}

	validateDataBounds := func(idx uint64) bool {
		if idx >= uint64(len(e.Raw.Data)) {
			slog.Warn("invalid agent registered event", "data", e.Raw.Data, "idx", idx)
			return false
		}
		return true
	}

	agent := e.Raw.Keys[1]
	creator := e.Raw.Keys[2]

	promptPrice := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))
	token := e.Raw.Data[2]
	endTime := e.Raw.Data[3].Uint64()
	model := e.Raw.Data[4]

	namePos := uint64(5)

	if !validateDataBounds(namePos) {
		return nil, false
	}

	nameCount := e.Raw.Data[namePos].Uint64()
	nameSize := 3 + nameCount
	systemPromptPos := namePos + nameSize

	if !validateDataBounds(systemPromptPos) {
		return nil, false
	}

	systemPromptCount := e.Raw.Data[systemPromptPos].Uint64()
	systemPromptSize := 3 + systemPromptCount

	if !validateDataBounds(systemPromptPos + systemPromptSize - 1) {
		return nil, false
	}

	name, err := starknet.ByteArrFeltToString(e.Raw.Data[namePos : namePos+nameSize])
	if err != nil {
		return nil, false
	}

	systemPrompt, err := starknet.ByteArrFeltToString(e.Raw.Data[systemPromptPos : systemPromptPos+systemPromptSize])
	if err != nil {
		return nil, false
	}

	return &AgentRegisteredEvent{
		Agent:        agent,
		Creator:      creator,
		PromptPrice:  promptPrice,
		TokenAddress: token,
		EndTime:      endTime,
		Model:        model,
		Name:         name,
		SystemPrompt: systemPrompt,
	}, true
}

type PromptPaidEvent struct {
	User     *felt.Felt
	PromptID uint64
	TweetID  uint64
	Prompt   string
}

const (
	PromptPaidEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252 +
		MinimumSizeFelt252 +
		MinimumSizeFelt252
)

func (e *Event) ToPromptPaidEvent() (*PromptPaidEvent, bool) {
	if e.Type != EventPromptPaid {
		return nil, false
	}

	if len(e.Raw.Keys) < PromptPaidEventKeysMinimumSize {
		slog.Warn("invalid prompt paid event", "keys", e.Raw.Keys)
		return nil, false
	}

	user := e.Raw.Keys[1]
	promptID := e.Raw.Keys[2].Uint64()
	tweetID := e.Raw.Keys[3].Uint64()

	prompt, err := starknet.ByteArrFeltToString(e.Raw.Data)
	if err != nil {
		slog.Warn("invalid prompt paid event", "data", e.Raw.Data)
		return nil, false
	}

	return &PromptPaidEvent{
		User:     user,
		PromptID: promptID,
		TweetID:  tweetID,
		Prompt:   prompt,
	}, true
}

type PromptConsumedEvent struct {
	PromptID    uint64
	Amount      *big.Int
	CreatorFee  *big.Int
	ProtocolFee *big.Int
	DrainedTo   *felt.Felt
}

const (
	PromptConsumedEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeUint64

	PromptConsumedEventDataMinimumSize = 0 +
		MinimumSizeUint256 +
		MinimumSizeUint256 +
		MinimumSizeUint256 +
		MinimumSizeFelt252
)

func (e *Event) ToPromptConsumedEvent() (*PromptConsumedEvent, bool) {
	if e.Type != EventPromptConsumed {
		return nil, false
	}

	if len(e.Raw.Keys) < PromptConsumedEventKeysMinimumSize {
		slog.Warn("invalid prompt consumed event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) < PromptConsumedEventDataMinimumSize {
		slog.Warn("invalid prompt consumed event", "data", e.Raw.Data)
		return nil, false
	}

	promptID := e.Raw.Keys[1].Uint64()
	amount := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))
	creatorFee := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[2:4]))
	protocolFee := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[4:6]))
	drainedTo := e.Raw.Data[6]

	return &PromptConsumedEvent{
		PromptID:    promptID,
		Amount:      amount,
		CreatorFee:  creatorFee,
		ProtocolFee: protocolFee,
		DrainedTo:   drainedTo,
	}, true
}

type DrainedEvent struct {
	PromptID uint64
	User     *felt.Felt
	To       *felt.Felt
	Amount   *big.Int
}

const (
	DrainedEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeUint64 +
		MinimumSizeFelt252 +
		MinimumSizeFelt252

	DrainedEventDataMinimumSize = 0 +
		MinimumSizeUint256
)

func (e *Event) ToDrainedEvent() (*DrainedEvent, bool) {
	if e.Type != EventDrained {
		return nil, false
	}

	if len(e.Raw.Keys) < DrainedEventKeysMinimumSize {
		slog.Warn("invalid drained event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) < DrainedEventDataMinimumSize {
		slog.Warn("invalid drained event", "data", e.Raw.Data)
		return nil, false
	}

	promptID := e.Raw.Keys[1].Uint64()
	user := e.Raw.Keys[2]
	to := e.Raw.Keys[3]
	amount := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))

	return &DrainedEvent{
		PromptID: promptID,
		User:     user,
		To:       to,
		Amount:   amount,
	}, true
}

type WithdrawnEvent struct {
	To     *felt.Felt
	Amount *big.Int
}

const (
	WithdrawnEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252

	WithdrawnEventDataMinimumSize = 0 +
		MinimumSizeUint256
)

func (e *Event) ToWithdrawnEvent() (*WithdrawnEvent, bool) {
	if e.Type != EventWithdrawn {
		return nil, false
	}

	if len(e.Raw.Keys) < WithdrawnEventKeysMinimumSize {
		slog.Warn("invalid withdrawn event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) < WithdrawnEventDataMinimumSize {
		slog.Warn("invalid withdrawn event", "data", e.Raw.Data)
		return nil, false
	}

	to := e.Raw.Keys[1]
	amount := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))

	return &WithdrawnEvent{
		To:     to,
		Amount: amount,
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

	ok := true

	if keyCount >= 3 {
		from = e.Raw.Keys[1]
		to = e.Raw.Keys[2]

		if dataCount == 1 {
			amount = e.Raw.Data[0].BigInt(new(big.Int))
		} else if dataCount == 2 {
			amount = snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))
		} else if keyCount == 4 {
			amount = e.Raw.Keys[3].BigInt(new(big.Int))
		} else if keyCount == 5 {
			amount = snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Keys[3:5]))
		} else {
			ok = false
		}
	} else if dataCount >= 3 {
		from = e.Raw.Data[0]
		to = e.Raw.Data[1]

		if dataCount == 3 {
			amount = e.Raw.Data[2].BigInt(new(big.Int))
		} else if dataCount == 4 {
			amount = snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[2:4]))
		} else {
			ok = false
		}
	} else {
		ok = false
	}

	if !ok {
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
	Token             *felt.Felt
	MinPromptPrice    *big.Int
	MinInitialBalance *big.Int
}

const (
	TokenAddedEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252

	TokenAddedEventDataMinimumSize = 0 +
		MinimumSizeUint256 +
		MinimumSizeUint256
)

func (e *Event) ToTokenAddedEvent() (*TokenAddedEvent, bool) {
	if e.Type != EventTokenAdded {
		return nil, false
	}

	if len(e.Raw.Keys) < TokenAddedEventKeysMinimumSize {
		slog.Warn("invalid token added event", "keys", e.Raw.Keys)
		return nil, false
	}

	if len(e.Raw.Data) < TokenAddedEventDataMinimumSize {
		slog.Warn("invalid token added event", "data", e.Raw.Data)
		return nil, false
	}

	token := e.Raw.Keys[1]

	minPromptPrice := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[0:2]))
	minInitialBalance := snaccount.Uint256ToBigInt([2]*felt.Felt(e.Raw.Data[2:4]))

	return &TokenAddedEvent{
		Token:             token,
		MinPromptPrice:    minPromptPrice,
		MinInitialBalance: minInitialBalance,
	}, true
}

type TokenRemovedEvent struct {
	Token *felt.Felt
}

const (
	TokenRemovedEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252
)

func (e *Event) ToTokenRemovedEvent() (*TokenRemovedEvent, bool) {
	if e.Type != EventTokenRemoved {
		return nil, false
	}

	if len(e.Raw.Keys) < TokenRemovedEventKeysMinimumSize {
		slog.Warn("invalid token removed event", "keys", e.Raw.Keys)
		return nil, false
	}

	token := e.Raw.Keys[1]

	return &TokenRemovedEvent{
		Token: token,
	}, true
}

type TeeUnencumberedEvent struct {
	Tee *felt.Felt
}

const (
	TeeUnencumberedEventKeysMinimumSize = 0 +
		MinimumSizeSelector +
		MinimumSizeFelt252
)

func (e *Event) ToTeeUnencumberedEvent() (*TeeUnencumberedEvent, bool) {
	if e.Type != EventTeeUnencumbered {
		return nil, false
	}

	if len(e.Raw.Keys) < TeeUnencumberedEventKeysMinimumSize {
		slog.Warn("invalid tee unencumbered event", "keys", e.Raw.Keys)
		return nil, false
	}

	tee := e.Raw.Keys[1]

	return &TeeUnencumberedEvent{
		Tee: tee,
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
	Client          starknet.ProviderWrapper
	SafeBlockDelta  uint64
	TickRate        time.Duration
	StartupTickRate time.Duration
	IndexChunkSize  uint
	RegistryAddress *felt.Felt
	InitialState    *EventWatcherInitialState
}

// EventsListEntry holds a list of events and the number of subscribers watching them.
type EventsListEntry struct {
	events     []*Event
	watchCount uint64
}

// EventWatcher fetches events from Starknet in block ranges, parses them, and
// distributes them to subscribers (AgentRegistered, Transfer, PromptPaid, etc.).
type EventWatcher struct {
	client             starknet.ProviderWrapper
	lastIndexedBlock   uint64
	safeBlockDelta     uint64
	tickRate           time.Duration
	startupTickRate    time.Duration
	indexChunkSize     uint
	initializedAtBlock uint64

	// Subscribers for specific event types
	mu          sync.RWMutex
	subs        map[EventType][]*EventSubscriber
	eventsLists map[EventType]*EventsListEntry
	nextSubID   int64

	// Add event cache
	eventCache *lru.Cache[[32]byte, struct{}]
}

// NewEventWatcher initializes a new EventWatcher.
func NewEventWatcher(cfg *EventWatcherConfig) (*EventWatcher, error) {
	if cfg.InitialState == nil {
		cfg.InitialState = &EventWatcherInitialState{
			LastIndexedBlock: 0,
		}
	}

	cache, err := lru.New[[32]byte, struct{}](10000)
	if err != nil {
		return nil, fmt.Errorf("failed to create event cache: %w", err)
	}

	return &EventWatcher{
		client:             cfg.Client,
		lastIndexedBlock:   cfg.InitialState.LastIndexedBlock,
		safeBlockDelta:     cfg.SafeBlockDelta,
		tickRate:           cfg.TickRate,
		startupTickRate:    cfg.StartupTickRate,
		indexChunkSize:     cfg.IndexChunkSize,
		initializedAtBlock: 0,
		subs:               make(map[EventType][]*EventSubscriber),
		eventsLists:        make(map[EventType]*EventsListEntry),
		eventCache:         cache,
	}, nil
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

	eventsList, ok := w.eventsLists[typ]
	if !ok {
		eventsList = &EventsListEntry{
			events:     make([]*Event, 0, w.indexChunkSize),
			watchCount: 0,
		}
	}

	eventsList.watchCount++
	w.eventsLists[typ] = eventsList

	return id
}

// Unsubscribe removes a subscriber by its subscription ID.
func (w *EventWatcher) Unsubscribe(id int64) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	for typ, subscribers := range w.subs {
		for i, sub := range subscribers {
			if sub.id == id {
				eventsList, ok := w.eventsLists[typ]
				if !ok {
					continue
				}

				eventsList.watchCount--
				if eventsList.watchCount == 0 {
					delete(w.eventsLists, typ)
				} else {
					w.eventsLists[typ] = eventsList
				}

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

	var err error
	if err := w.client.Do(func(provider rpc.RpcProvider) error {
		w.initializedAtBlock, err = provider.BlockNumber(ctx)
		return err
	}); err != nil {
		return fmt.Errorf("failed to get current block number: %w", snaccount.FormatRpcError(err))
	}

	tickDuration := w.startupTickRate

	for {
		if w.lastIndexedBlock >= w.initializedAtBlock {
			tickDuration = w.tickRate
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(tickDuration):
			if err := w.indexBlocks(ctx); err != nil {
				slog.Error("indexBlocks failed", "error", err)
				// continue attempting on next tick
			}
		}
	}
}

// fetchEvents fetches events from the Starknet node following a continuation token.
func (w *EventWatcher) fetchEvents(ctx context.Context, filter rpc.EventFilter) ([]rpc.EmittedEvent, error) {
	var events []rpc.EmittedEvent
	continuationToken := ""

	for {
		var eventsResp *rpc.EventChunk
		var err error

		if err := w.client.Do(func(provider rpc.RpcProvider) error {
			eventsResp, err = provider.Events(ctx, rpc.EventsInput{
				EventFilter: filter,
				ResultPageRequest: rpc.ResultPageRequest{
					ContinuationToken: continuationToken,
					ChunkSize:         int(w.indexChunkSize),
				},
			})
			return err
		}); err != nil {
			return nil, fmt.Errorf("failed to get events from %v to %v: %w", filter.FromBlock, filter.ToBlock, snaccount.FormatRpcError(err))
		}

		lastTxHash := new(felt.Felt)
		eventId := 0

		for _, ev := range eventsResp.Events {
			if lastTxHash.Equal(ev.TransactionHash) {
				eventId++
			} else {
				lastTxHash = ev.TransactionHash
				eventId = 0
			}

			hash := eventHash(ev, eventId)
			if _, exists := w.eventCache.Peek(hash); !exists {
				events = append(events, ev)
				w.eventCache.Add(hash, struct{}{})
			}
		}

		continuationToken = eventsResp.ContinuationToken
		if continuationToken == "" {
			break
		}
	}

	return events, nil
}

// indexBlocks fetches blocks ranging from (lastIndexedBlock+1) to safeBlock in chunks, then parses events.
func (w *EventWatcher) indexBlocks(ctx context.Context) error {
	var currentBlock uint64
	var err error

	if err := w.client.Do(func(provider rpc.RpcProvider) error {
		currentBlock, err = provider.BlockNumber(ctx)
		return err
	}); err != nil {
		return fmt.Errorf("failed to get current block number: %w", snaccount.FormatRpcError(err))
	}

	safeBlock := currentBlock - w.safeBlockDelta

	from := w.lastIndexedBlock
	toBlock := uint64(0)
	for {
		toBlock = from + uint64(w.indexChunkSize) - 1
		if toBlock > safeBlock {
			toBlock = safeBlock
		}
		blockId := rpc.WithBlockNumber(toBlock)
		if toBlock == safeBlock {
			blockId = rpc.WithBlockTag("pending")
		}

		if from > toBlock {
			break
		}

		if from != toBlock {
			slog.Info("processing block chunk", "fromBlock", from, "toBlock", toBlock)
		}

		// Gather events for these blocks from the node
		events, err := w.fetchEvents(ctx, rpc.EventFilter{
			FromBlock: rpc.WithBlockNumber(from),
			ToBlock:   blockId,
			// We'll fetch all possible keys of interest in a single request:
			Keys: [][]*felt.Felt{EventSelectors},
		})
		if err != nil {
			return fmt.Errorf("failed to get events from %v to %v: %w", from, toBlock, snaccount.FormatRpcError(err))
		}

		if from != toBlock {
			slog.Info("got events", "count", len(events))
		}

		// Parse each event into our local struct and broadcast.
		for _, rawEvent := range events {
			parsedEvent, ok := w.parseEvent(rawEvent)
			if ok {
				for typ, eventList := range w.eventsLists {
					if typ&parsedEvent.Type != 0 {
						eventList.events = append(eventList.events, &parsedEvent)
					}
				}
			}
		}

		w.broadcast(from, toBlock)

		// clean up event lists
		for _, eventList := range w.eventsLists {
			eventList.events = eventList.events[:0]
		}

		w.mu.Lock()
		w.lastIndexedBlock = toBlock
		w.mu.Unlock()

		if from != toBlock {
			slog.Info("finished chunk", "lastIndexedBlock", w.lastIndexedBlock)
		}

		if from >= safeBlock {
			break
		}

		from += uint64(w.indexChunkSize)
	}

	return nil
}

// parseEvent examines the raw keys/data to determine the event type and produce an Event struct.
func (w *EventWatcher) parseEvent(raw rpc.EmittedEvent) (Event, bool) {
	// The first key is the event selector
	selectorBytes := raw.Keys[0].Bytes()
	ev := Event{
		Raw: raw,
	}

	for _, item := range EventItems {
		if selectorBytes == item.SelectorBytes {
			ev.Type = item.Type
			return ev, true
		}
	}

	return Event{}, false
}

// broadcast routes the parsed events to the correct set of subscribers.
func (w *EventWatcher) broadcast(fromBlock uint64, toBlock uint64) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	for typ, eventList := range w.eventsLists {
		for _, sub := range w.subs[typ] {
			sub.ch <- &EventSubscriptionData{
				Events:    eventList.events,
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

func eventHash(ev rpc.EmittedEvent, eventIndex int) [32]byte {
	h := sha256.New()
	h.Write(ev.TransactionHash.Marshal())
	for _, key := range ev.Keys {
		h.Write(key.Marshal())
	}
	for _, data := range ev.Data {
		h.Write(data.Marshal())
	}
	binary.Write(h, binary.BigEndian, uint64(eventIndex))
	return [32]byte(h.Sum(nil))
}
