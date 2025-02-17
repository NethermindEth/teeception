package indexer

import (
	"fmt"
	"log/slog"
	"maps"
	"math/big"
	"slices"
	"sync"
	"time"

	"github.com/NethermindEth/teeception/pkg/indexer/utils"
)

// AgentBalanceIndexerDatabaseReader is the reader for an AgentBalanceIndexerDatabase.
type AgentBalanceIndexerDatabaseReader interface {
	GetLeaderboard(start, end uint64, priceCache AgentBalanceIndexerPriceCache) (*AgentLeaderboardResponse, error)
	GetLeaderboardCount() uint64
	GetAgentExists(addr [32]byte) bool
	GetAgentBalance(addr [32]byte) (*AgentBalance, bool)
	GetTotalAgentBalances() map[[32]byte]*big.Int
	GetLastIndexedBlock() uint64
}

// AgentBalanceIndexerDatabaseWriter is the writer for an AgentBalanceIndexerDatabase.
type AgentBalanceIndexerDatabaseWriter interface {
	SortAgents(priceCache AgentBalanceIndexerPriceCache)

	SetAgentBalance(addr [32]byte, balance *AgentBalance)
	SetLastIndexedBlock(block uint64)
}

// AgentBalanceIndexerDatabase is the database for an AgentBalanceIndexer.
type AgentBalanceIndexerDatabase interface {
	AgentBalanceIndexerDatabaseReader
	AgentBalanceIndexerDatabaseWriter
}

// AgentBalanceIndexerDatabaseInMemory is an in-memory implementation of the AgentBalanceIndexerDatabase interface.
type AgentBalanceIndexerDatabaseInMemory struct {
	balances map[[32]byte]*AgentBalance

	sortedAgentsMu      sync.RWMutex
	sortedAgents        *utils.LazySortedList[[32]byte]
	totalActiveBalances map[[32]byte]*big.Int

	lastIndexedBlock uint64
}

var _ AgentBalanceIndexerDatabase = (*AgentBalanceIndexerDatabaseInMemory)(nil)

// NewAgentBalanceIndexerDatabaseInMemory creates a new in-memory AgentBalanceIndexerDatabase.
func NewAgentBalanceIndexerDatabaseInMemory(initialBlock uint64) *AgentBalanceIndexerDatabaseInMemory {
	return &AgentBalanceIndexerDatabaseInMemory{
		balances:            make(map[[32]byte]*AgentBalance),
		lastIndexedBlock:    initialBlock,
		sortedAgents:        utils.NewLazySortedList[[32]byte](),
		totalActiveBalances: make(map[[32]byte]*big.Int),
	}
}

// GetAgentExists returns true if the agent exists in the database.
func (db *AgentBalanceIndexerDatabaseInMemory) GetAgentExists(addr [32]byte) bool {
	_, ok := db.balances[addr]
	return ok
}

// GetAgentBalance returns the agent balance, if it exists.
func (db *AgentBalanceIndexerDatabaseInMemory) GetAgentBalance(addr [32]byte) (*AgentBalance, bool) {
	balance, ok := db.balances[addr]
	return balance, ok
}

// SetAgentBalance sets the agent balance.
func (db *AgentBalanceIndexerDatabaseInMemory) SetAgentBalance(addr [32]byte, balance *AgentBalance) {
	if _, ok := db.balances[addr]; !ok {
		db.sortedAgents.Add(addr)
	}

	db.balances[addr] = balance
}

// GetLastIndexedBlock returns the last indexed block.
func (db *AgentBalanceIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

// SetLastIndexedBlock sets the last indexed block.
func (db *AgentBalanceIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) {
	db.lastIndexedBlock = block
}

// SortAgents sorts the agents by balance in descending order, using USD value
func (db *AgentBalanceIndexerDatabaseInMemory) SortAgents(priceCache AgentBalanceIndexerPriceCache) {
	db.sortedAgentsMu.Lock()
	defer db.sortedAgentsMu.Unlock()

	if db.sortedAgents.InnerLen() != len(db.balances) {
		db.sortedAgents.Add(slices.Collect(maps.Keys(db.balances))...)
	}

	currentTime := uint64(time.Now().Unix())

	db.sortedAgents.Sort(func(a, b [32]byte) int {
		balA := db.balances[a]
		balB := db.balances[b]

		aFinalized := balA.EndTime < currentTime || balA.IsDrained
		bFinalized := balB.EndTime < currentTime || balB.IsDrained

		if aFinalized != bFinalized {
			if aFinalized {
				return 1
			}

			return -1
		}

		if balA.Token == balB.Token {
			return -balA.DrainAmount.Cmp(balB.DrainAmount)
		}

		rateA, ok := priceCache.GetTokenRate(balA.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "token", balA.Token)
			return 0
		}

		rateB, ok := priceCache.GetTokenRate(balB.Token)
		if !ok {
			slog.Error("failed to get USD rate for agent", "token", balB.Token)
			return 0
		}

		return -balA.DrainAmount.Mul(balA.DrainAmount, rateA).Cmp(balB.DrainAmount.Mul(balB.DrainAmount, rateB))
	})

	db.totalActiveBalances = make(map[[32]byte]*big.Int)
	for _, agent := range db.sortedAgents.Items() {
		bal := db.balances[agent]
		isFinalized := bal.EndTime < currentTime || bal.IsDrained

		// since we know the finalized agents are at the end of the list, we can break early
		if isFinalized {
			break
		}

		tokenAddr := bal.Token.Bytes()
		totalActiveBalance, ok := db.totalActiveBalances[tokenAddr]
		if !ok {
			totalActiveBalance = big.NewInt(0)
		}

		db.totalActiveBalances[tokenAddr] = totalActiveBalance.Add(totalActiveBalance, bal.Amount)
	}
}

// GetLeaderboard returns the leaderboard for the given range.
func (db *AgentBalanceIndexerDatabaseInMemory) GetLeaderboard(start, end uint64, _ AgentBalanceIndexerPriceCache) (*AgentLeaderboardResponse, error) {
	db.sortedAgentsMu.RLock()
	defer db.sortedAgentsMu.RUnlock()

	if start > end {
		return nil, fmt.Errorf("invalid range: start (%d) > end (%d)", start, end)
	}

	if start >= uint64(db.sortedAgents.Len()) {
		return &AgentLeaderboardResponse{
			Agents:     make([][32]byte, 0),
			AgentCount: uint64(db.sortedAgents.Len()),
			LastBlock:  db.lastIndexedBlock,
		}, nil
	}

	if end > uint64(db.sortedAgents.Len()) {
		end = uint64(db.sortedAgents.Len())
	}

	agents, ok := db.sortedAgents.GetRange(int(start), int(end))
	if !ok {
		return nil, fmt.Errorf("failed to get range of agents")
	}

	leaderboard := &AgentLeaderboardResponse{
		Agents:     agents,
		AgentCount: uint64(db.sortedAgents.Len()),
		LastBlock:  db.lastIndexedBlock,
	}

	return leaderboard, nil
}

// GetLeaderboardCount returns the number of agents in the leaderboard.
func (db *AgentBalanceIndexerDatabaseInMemory) GetLeaderboardCount() uint64 {
	return uint64(db.sortedAgents.Len())
}

// GetTotalAgentBalances returns the total balances of all agents in the database per token.
func (db *AgentBalanceIndexerDatabaseInMemory) GetTotalAgentBalances() map[[32]byte]*big.Int {
	db.sortedAgentsMu.RLock()
	defer db.sortedAgentsMu.RUnlock()

	balances := make(map[[32]byte]*big.Int)
	for tokenAddr, balance := range db.totalActiveBalances {
		balances[tokenAddr] = balance
	}

	return balances
}
