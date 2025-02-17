package indexer

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log/slog"
	"maps"
	"math/big"
	"slices"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"

	"github.com/NethermindEth/juno/core/felt"

	"github.com/NethermindEth/teeception/pkg/indexer/utils"
)

type UserIndexerDatabaseReader interface {
	GetUserInfo(addr [32]byte) (*UserInfo, bool)
	GetUserExists(addr [32]byte) bool
	GetLastIndexedBlock() uint64
	GetLeaderboard(start, end uint64, priceCache AgentBalanceIndexerPriceCache) (*UserLeaderboardResponse, error)
	GetLeaderboardCount() uint64
}

type UserIndexerDatabaseWriter interface {
	StoreAgentRegisteredData(agentRegisteredEvent *AgentRegisteredEvent)
	StorePromptConsumedData(agentAddr *felt.Felt, promptConsumedEvent *PromptConsumedEvent)
	StorePromptPaidData(agentAddr *felt.Felt, promptPaidEvent *PromptPaidEvent)
	SetLastIndexedBlock(block uint64)
	SortUsers(priceCache AgentBalanceIndexerPriceCache)
}

type UserIndexerDatabase interface {
	UserIndexerDatabaseReader
	UserIndexerDatabaseWriter
}

type UserIndexerDatabaseInMemory struct {
	mu               sync.RWMutex
	agentPrizes      map[[32]byte]*big.Int
	agentTokens      map[[32]byte][32]byte
	infos            map[[32]byte]*UserInfo
	lastIndexedBlock uint64
	promptCache      *expirable.LRU[UserPromptCacheKey, UserPromptCacheData]
	sortedUsers      *utils.LazySortedList[[32]byte]
}

type UserPromptCacheKey [32]byte

type UserPromptCacheData struct {
	User [32]byte
}

const userPromptCacheSize = 10000
const userPromptCacheTTL = 30 * time.Minute

var _ UserIndexerDatabase = (*UserIndexerDatabaseInMemory)(nil)

type UserLeaderboardResponse struct {
	Users     [][32]byte
	UserCount uint64
	LastBlock uint64
}

func NewUserIndexerDatabaseInMemory(initialBlock uint64) *UserIndexerDatabaseInMemory {
	return &UserIndexerDatabaseInMemory{
		infos:            make(map[[32]byte]*UserInfo),
		agentPrizes:      make(map[[32]byte]*big.Int),
		agentTokens:      make(map[[32]byte][32]byte),
		lastIndexedBlock: initialBlock,
		promptCache: expirable.NewLRU[UserPromptCacheKey, UserPromptCacheData](
			userPromptCacheSize,
			nil,
			userPromptCacheTTL,
		),
		sortedUsers: utils.NewLazySortedList[[32]byte](),
	}
}

func (db *UserIndexerDatabaseInMemory) GetUserInfo(addr [32]byte) (*UserInfo, bool) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	info, ok := db.infos[addr]
	if !ok {
		return nil, false
	}
	return info, true
}

func (db *UserIndexerDatabaseInMemory) GetUserExists(addr [32]byte) bool {
	db.mu.RLock()
	defer db.mu.RUnlock()

	_, ok := db.infos[addr]
	return ok
}

func (db *UserIndexerDatabaseInMemory) StoreAgentRegisteredData(agentRegisteredEvent *AgentRegisteredEvent) {
	addrBytes := agentRegisteredEvent.Agent.Bytes()

	db.mu.Lock()
	defer db.mu.Unlock()

	_ = db.getOrCreateAgentPrize(addrBytes)
	db.agentTokens[addrBytes] = agentRegisteredEvent.TokenAddress.Bytes()
}

func (db *UserIndexerDatabaseInMemory) StorePromptPaidData(agentAddr *felt.Felt, promptPaidEvent *PromptPaidEvent) {
	userAddrBytes := promptPaidEvent.User.Bytes()
	agentAddrBytes := agentAddr.Bytes()

	db.mu.Lock()
	defer db.mu.Unlock()

	// Store the user in cache for this prompt
	db.promptCache.Add(
		db.promptCacheKey(agentAddrBytes, promptPaidEvent.PromptID),
		UserPromptCacheData{
			User: userAddrBytes,
		},
	)

	info := db.getOrCreateUserInfo(userAddrBytes)
	info.PromptCount++
	db.infos[userAddrBytes] = info
}

func (db *UserIndexerDatabaseInMemory) StorePromptConsumedData(agentAddr *felt.Felt, promptConsumedEvent *PromptConsumedEvent) {
	agentAddrBytes := agentAddr.Bytes()

	db.mu.Lock()
	defer db.mu.Unlock()

	prize := db.getOrCreateAgentPrize(agentAddrBytes)
	db.agentPrizes[agentAddrBytes] = prize.Add(prize, promptConsumedEvent.Amount)

	if promptConsumedEvent.DrainedTo.Cmp(agentAddr) == 0 {
		return
	}

	promptCacheKey := db.promptCacheKey(agentAddrBytes, promptConsumedEvent.PromptID)
	promptCacheData, ok := db.promptCache.Peek(promptCacheKey)
	if !ok {
		slog.Error("prompt user cache data not found")
		promptCacheData = UserPromptCacheData{
			User: promptConsumedEvent.DrainedTo.Bytes(),
		}
	} else {
		db.promptCache.Remove(promptCacheKey)
	}

	userInfo := db.getOrCreateUserInfo(promptCacheData.User)
	agentToken, ok := db.agentTokens[agentAddrBytes]
	if !ok {
		slog.Error("agent token not found", "agent", agentAddrBytes)
		return
	}
	accruedBalanceInToken, ok := userInfo.AccruedBalances[agentToken]
	if !ok {
		accruedBalanceInToken = big.NewInt(0)
	}
	accruedBalanceInToken = accruedBalanceInToken.Add(accruedBalanceInToken, prize)
	userInfo.AccruedBalances[agentToken] = accruedBalanceInToken
	userInfo.BreakCount++
	db.infos[promptCacheData.User] = userInfo
}

func (db *UserIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

func (db *UserIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) {
	db.lastIndexedBlock = block
}

func (db *UserIndexerDatabaseInMemory) getOrCreateUserInfo(addr [32]byte) *UserInfo {
	info, exists := db.infos[addr]
	if !exists {
		info = &UserInfo{
			Address:         addr,
			AccruedBalances: make(map[[32]byte]*big.Int),
			PromptCount:     0,
			BreakCount:      0,
		}
		db.infos[addr] = info
		db.sortedUsers.Add(addr)
	}
	return info
}

func (db *UserIndexerDatabaseInMemory) getOrCreateAgentPrize(addr [32]byte) *big.Int {
	prize, exists := db.agentPrizes[addr]
	if !exists {
		prize = big.NewInt(0)
		db.agentPrizes[addr] = prize
	}
	return prize
}

func (db *UserIndexerDatabaseInMemory) promptCacheKey(addr [32]byte, promptID uint64) UserPromptCacheKey {
	data := make([]byte, 40)
	copy(data[:32], addr[:])
	binary.BigEndian.PutUint64(data[32:], promptID)

	hash := sha256.Sum256(data)
	return UserPromptCacheKey(hash)
}

func (db *UserIndexerDatabaseInMemory) GetLeaderboard(start, end uint64, priceCache AgentBalanceIndexerPriceCache) (*UserLeaderboardResponse, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if start > end {
		return nil, fmt.Errorf("invalid range: start (%d) > end (%d)", start, end)
	}

	effectiveLen := uint64(db.sortedUsers.Len())
	if start >= effectiveLen {
		return &UserLeaderboardResponse{
			Users:     make([][32]byte, 0),
			UserCount: effectiveLen,
			LastBlock: db.lastIndexedBlock,
		}, nil
	}

	if end > effectiveLen {
		end = effectiveLen
	}

	users, ok := db.sortedUsers.GetRange(int(start), int(end))
	if !ok {
		return nil, fmt.Errorf("failed to get range of users")
	}

	leaderboard := &UserLeaderboardResponse{
		Users:     users,
		UserCount: effectiveLen,
		LastBlock: db.lastIndexedBlock,
	}

	return leaderboard, nil
}

func (db *UserIndexerDatabaseInMemory) GetLeaderboardCount() uint64 {
	return uint64(db.sortedUsers.Len())
}

func (db *UserIndexerDatabaseInMemory) SortUsers(priceCache AgentBalanceIndexerPriceCache) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.sortedUsers.InnerLen() != len(db.infos) {
		db.sortedUsers.Add(slices.Collect(maps.Keys(db.infos))...)
	}

	db.sortedUsers.Sort(func(a, b [32]byte) int {
		infoA := db.infos[a]
		infoB := db.infos[b]

		totalA := big.NewInt(0)
		for token, balance := range infoA.AccruedBalances {
			tokenFelt := new(felt.Felt).SetBytes(token[:])
			rate, ok := priceCache.GetTokenRate(tokenFelt)
			if !ok {
				slog.Error("failed to get rate for token", "token", token)
				continue
			}
			totalA.Add(totalA, new(big.Int).Mul(balance, rate))
		}

		totalB := big.NewInt(0)
		for token, balance := range infoB.AccruedBalances {
			tokenFelt := new(felt.Felt).SetBytes(token[:])
			rate, ok := priceCache.GetTokenRate(tokenFelt)
			if !ok {
				slog.Error("failed to get rate for token", "token", token)
				continue
			}
			totalB.Add(totalB, new(big.Int).Mul(balance, rate))
		}

		if totalA.Cmp(totalB) != 0 {
			return -totalA.Cmp(totalB)
		}

		if infoA.BreakCount != infoB.BreakCount {
			if infoA.BreakCount > infoB.BreakCount {
				return -1
			}
			return 1
		}

		if infoA.PromptCount != infoB.PromptCount {
			if infoA.PromptCount > infoB.PromptCount {
				return -1
			}
			return 1
		}

		return 0
	})
}
