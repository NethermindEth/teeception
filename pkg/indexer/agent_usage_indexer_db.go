package indexer

import (
	"sync"
)

type AgentUsageIndexerDatabaseReader interface {
	GetAgentUsage(addr [32]byte) (*AgentUsage, bool)
	GetAgentExists(addr [32]byte) bool
	GetLastIndexedBlock() uint64
}

type AgentUsageIndexerDatabaseWriter interface {
	SetAgentUsage(addr [32]byte, usage *AgentUsage)
	SetLastIndexedBlock(block uint64)
}

type AgentUsageIndexerDatabase interface {
	AgentUsageIndexerDatabaseReader
	AgentUsageIndexerDatabaseWriter
}

type AgentUsageIndexerDatabaseInMemory struct {
	usages           map[[32]byte]*AgentUsage
	lastIndexedBlock uint64
	mu               sync.RWMutex
}

func NewAgentUsageIndexerDatabaseInMemory(initialBlock uint64) *AgentUsageIndexerDatabaseInMemory {
	return &AgentUsageIndexerDatabaseInMemory{
		usages:           make(map[[32]byte]*AgentUsage),
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

func (db *AgentUsageIndexerDatabaseInMemory) SetAgentUsage(addr [32]byte, usage *AgentUsage) {
	db.mu.Lock()
	defer db.mu.Unlock()

	db.usages[addr] = usage
}

func (db *AgentUsageIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

func (db *AgentUsageIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) {
	db.mu.Lock()
	defer db.mu.Unlock()

	db.lastIndexedBlock = block
}
