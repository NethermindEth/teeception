package indexer

import (
	"crypto/sha256"
	"encoding/binary"
	"log/slog"
	"sync"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/hashicorp/golang-lru/v2/expirable"
)

type AgentUsageIndexerDatabaseReader interface {
	GetAgentUsage(addr [32]byte) (*AgentUsage, bool)
	GetAgentExists(addr [32]byte) bool
	GetLastIndexedBlock() uint64
	GetTotalUsage() *AgentUsageIndexerTotalUsage
}

type AgentUsageIndexerDatabaseWriter interface {
	StoreAgent(addr [32]byte)
	StorePromptPaidData(addr [32]byte, ev *PromptPaidEvent)
	StorePromptConsumedData(addr [32]byte, ev *PromptConsumedEvent)
	SetLastIndexedBlock(block uint64)
}

type AgentUsageIndexerDatabase interface {
	AgentUsageIndexerDatabaseReader
	AgentUsageIndexerDatabaseWriter
}

type AgentUsageIndexerDatabaseInMemory struct {
	mu          sync.RWMutex
	usages      map[[32]byte]*AgentUsage
	maxPrompts  uint64
	promptCache *expirable.LRU[
		AgentUsageIndexerDatabaseInMemoryPromptCacheKey,
		AgentUsageIndexerDatabaseInMemoryPromptCacheData,
	]
	totalUsage       *AgentUsageIndexerTotalUsage
	lastIndexedBlock uint64
}

type AgentUsageIndexerDatabaseInMemoryPromptCacheKey [32]byte

type AgentUsageIndexerDatabaseInMemoryPromptCacheData struct {
	TweetID uint64
	Prompt  string
}

var _ AgentUsageIndexerDatabase = (*AgentUsageIndexerDatabaseInMemory)(nil)

const agentUsageIndexerPromptCacheSize = 10000
const agentUsageIndexerPromptCacheTTL = 30 * time.Minute

func NewAgentUsageIndexerDatabaseInMemory(initialBlock, maxPrompts uint64) *AgentUsageIndexerDatabaseInMemory {
	return &AgentUsageIndexerDatabaseInMemory{
		usages:     make(map[[32]byte]*AgentUsage),
		maxPrompts: maxPrompts,
		promptCache: expirable.NewLRU[
			AgentUsageIndexerDatabaseInMemoryPromptCacheKey,
			AgentUsageIndexerDatabaseInMemoryPromptCacheData,
		](
			agentUsageIndexerPromptCacheSize,
			nil,
			agentUsageIndexerPromptCacheTTL,
		),
		lastIndexedBlock: initialBlock,
	}
}

func (db *AgentUsageIndexerDatabaseInMemory) GetAgentUsage(addr [32]byte) (*AgentUsage, bool) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	usage, ok := db.usages[addr]
	if !ok {
		return nil, false
	}
	return usage, true
}

func (db *AgentUsageIndexerDatabaseInMemory) GetAgentExists(addr [32]byte) bool {
	db.mu.RLock()
	defer db.mu.RUnlock()

	_, ok := db.usages[addr]
	return ok
}

func (db *AgentUsageIndexerDatabaseInMemory) StoreAgent(addr [32]byte) {
	db.mu.Lock()
	defer db.mu.Unlock()

	usage := db.getOrCreateAgentUsage(addr)
	db.usages[addr] = usage
}

func (db *AgentUsageIndexerDatabaseInMemory) StorePromptPaidData(addr [32]byte, promptPaidEvent *PromptPaidEvent) {
	db.mu.Lock()
	defer db.mu.Unlock()

	db.totalUsage.TotalAttempts++

	db.promptCache.Add(
		db.promptCacheKey(addr, promptPaidEvent.PromptID),
		AgentUsageIndexerDatabaseInMemoryPromptCacheData{
			TweetID: promptPaidEvent.TweetID,
			Prompt:  promptPaidEvent.Prompt,
		},
	)
}

func (db *AgentUsageIndexerDatabaseInMemory) StorePromptConsumedData(addr [32]byte, promptConsumedEvent *PromptConsumedEvent) {
	db.mu.Lock()
	defer db.mu.Unlock()

	usage := db.getOrCreateAgentUsage(addr)

	usage.BreakAttempts++

	var succeeded bool
	var drainAddress *felt.Felt

	if promptConsumedEvent.DrainedTo.Bytes() == addr {
		succeeded = false
		drainAddress = new(felt.Felt)
	} else {
		succeeded = true
		drainAddress = promptConsumedEvent.DrainedTo
	}

	promptCacheKey := db.promptCacheKey(addr, promptConsumedEvent.PromptID)
	promptCacheData, ok := db.promptCache.Peek(promptCacheKey)
	if !ok {
		slog.Error("prompt not found in cache", "agent", addr, "prompt", promptConsumedEvent.PromptID)
		promptCacheData = AgentUsageIndexerDatabaseInMemoryPromptCacheData{}
	} else {
		db.promptCache.Remove(promptCacheKey)
	}

	if succeeded {
		usage.IsDrained = true
		db.totalUsage.TotalSuccesses++
	}

	usage.LatestPrompts = append(usage.LatestPrompts, &AgentUsageLatestPrompt{
		PromptID:  promptConsumedEvent.PromptID,
		TweetID:   promptCacheData.TweetID,
		Prompt:    promptCacheData.Prompt,
		IsSuccess: succeeded,
		DrainedTo: drainAddress,
	})
	if uint64(len(usage.LatestPrompts)) > db.maxPrompts {
		usage.LatestPrompts = usage.LatestPrompts[1:]
	}

	db.usages[addr] = usage
}

func (db *AgentUsageIndexerDatabaseInMemory) GetTotalUsage() *AgentUsageIndexerTotalUsage {
	db.mu.RLock()
	defer db.mu.RUnlock()

	return db.totalUsage
}

func (db *AgentUsageIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

func (db *AgentUsageIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) {
	db.mu.Lock()
	defer db.mu.Unlock()

	db.lastIndexedBlock = block
}

func (db *AgentUsageIndexerDatabaseInMemory) getOrCreateAgentUsage(addr [32]byte) *AgentUsage {
	usage, ok := db.usages[addr]
	if !ok {
		usage = &AgentUsage{
			BreakAttempts: 0,
			LatestPrompts: make([]*AgentUsageLatestPrompt, 0, db.maxPrompts+1),
			IsDrained:     false,
		}
	}

	return usage
}

func (db *AgentUsageIndexerDatabaseInMemory) promptCacheKey(addr [32]byte, promptID uint64) AgentUsageIndexerDatabaseInMemoryPromptCacheKey {
	data := make([]byte, 40)
	copy(data[:32], addr[:])
	binary.BigEndian.PutUint64(data[32:], promptID)

	hash := sha256.Sum256(data)
	return AgentUsageIndexerDatabaseInMemoryPromptCacheKey(hash)
}
