package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
)

var (
	promptPaidSelector = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
)

type PromptPaidEvent struct {
	AgentAddress *felt.Felt
	FromAddress  *felt.Felt
	TweetID      uint64
}

type Indexer struct {
	client          *rpc.Provider
	lastBlockNumber uint64
	safeBlockDelta  uint64
	tickRate        time.Duration
}

type IndexerConfig struct {
	Client         *rpc.Provider
	SafeBlockDelta uint64
	TickRate       time.Duration
}

func NewIndexer(config IndexerConfig) *Indexer {
	return &Indexer{
		client:         config.Client,
		safeBlockDelta: config.SafeBlockDelta,
		tickRate:       config.TickRate,
	}
}

// Start begins indexing events and sends them to the provided channel
func (i *Indexer) Start(ctx context.Context, eventChan chan<- PromptPaidEvent) error {
	// Get initial block number
	blockNumber, err := i.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get initial block number: %v", err)
	}
	i.lastBlockNumber = blockNumber

	// Start indexing loop
	go func() {
		ticker := time.NewTicker(i.tickRate)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				events, err := i.getNewEvents(ctx)
				if err != nil {
					slog.Error("failed to get new events", "error", err)
					continue
				}

				// Send events to channel
				for _, event := range events {
					select {
					case <-ctx.Done():
						return
					case eventChan <- event:
					}
				}
			}
		}
	}()

	return nil
}

func (i *Indexer) getNewEvents(ctx context.Context) ([]PromptPaidEvent, error) {
	blockNumber, err := i.client.BlockNumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest block number: %v", err)
	}

	blockNumber = blockNumber - i.safeBlockDelta

	if blockNumber <= i.lastBlockNumber {
		return nil, nil
	}

	slog.Info("processing new blocks", "from_block", i.lastBlockNumber, "to_block", blockNumber)

	eventChunk, err := i.client.Events(ctx, rpc.EventsInput{
		EventFilter: rpc.EventFilter{
			FromBlock: rpc.WithBlockNumber(i.lastBlockNumber + 1),
			ToBlock:   rpc.WithBlockNumber(blockNumber),
			Keys: [][]*felt.Felt{
				{promptPaidSelector},
			},
		},
		ResultPageRequest: rpc.ResultPageRequest{
			ChunkSize: 1000,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get block receipts: %v", err)
	}

	events := make([]PromptPaidEvent, 0, len(eventChunk.Events))
	for _, event := range eventChunk.Events {
		if parsed, ok := i.parseEvent(event); ok {
			events = append(events, parsed)
		}
	}

	i.lastBlockNumber = blockNumber
	return events, nil
}

func (i *Indexer) parseEvent(event rpc.EmittedEvent) (PromptPaidEvent, bool) {
	if event.Keys[0].Cmp(promptPaidSelector) != 0 {
		return PromptPaidEvent{}, false
	}

	agentAddress := event.FromAddress
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
