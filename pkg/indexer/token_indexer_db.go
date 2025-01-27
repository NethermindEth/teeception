package indexer

// TokenIndexerDatabaseReader is the database reader for a TokenIndexer.
type TokenIndexerDatabaseReader interface {
	GetTokenInfo(token [32]byte) (*TokenInfo, bool)
	GetLastIndexedBlock() uint64
	GetTokens() map[[32]byte]*TokenInfo
}

// TokenIndexerDatabaseWriter is the database writer for a TokenIndexer.
type TokenIndexerDatabaseWriter interface {
	SetTokenInfo(token [32]byte, info *TokenInfo) error
	SetLastIndexedBlock(block uint64) error
}

// TokenIndexerDatabase is the database for a TokenIndexer.
type TokenIndexerDatabase interface {
	TokenIndexerDatabaseReader
	TokenIndexerDatabaseWriter
}

// TokenIndexerDatabaseInMemory is an in-memory implementation of the TokenIndexerDatabase interface.
type TokenIndexerDatabaseInMemory struct {
	tokens           map[[32]byte]*TokenInfo
	lastIndexedBlock uint64
}

var _ TokenIndexerDatabase = (*TokenIndexerDatabaseInMemory)(nil)

// NewTokenIndexerDatabaseInMemory creates a new in-memory TokenIndexerDatabase.
func NewTokenIndexerDatabaseInMemory(initialBlock uint64) *TokenIndexerDatabaseInMemory {
	return &TokenIndexerDatabaseInMemory{
		tokens:           make(map[[32]byte]*TokenInfo),
		lastIndexedBlock: initialBlock,
	}
}

// GetTokenInfo returns the TokenInfo for a given token address.
func (db *TokenIndexerDatabaseInMemory) GetTokenInfo(token [32]byte) (*TokenInfo, bool) {
	info, ok := db.tokens[token]
	return info, ok
}

// SetTokenInfo sets the TokenInfo for a given token address.
func (db *TokenIndexerDatabaseInMemory) SetTokenInfo(token [32]byte, info *TokenInfo) error {
	if info == nil {
		delete(db.tokens, token)
		return nil
	}

	db.tokens[token] = info
	return nil
}

// GetLastIndexedBlock returns the last indexed block.
func (db *TokenIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

// SetLastIndexedBlock sets the last indexed block.
func (db *TokenIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) error {
	db.lastIndexedBlock = block
	return nil
}

// GetTokens returns all the tokens in the database.
func (db *TokenIndexerDatabaseInMemory) GetTokens() map[[32]byte]*TokenInfo {
	return db.tokens
}
