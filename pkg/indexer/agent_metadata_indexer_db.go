package indexer

// AgentMetadataIndexerDatabaseReader is the database reader for an AgentMetadataIndexer.
type AgentMetadataIndexerDatabaseReader interface {
	GetMetadata(addr [32]byte) (AgentMetadata, bool)
	GetLastIndexedBlock() uint64
}

// AgentMetadataIndexerDatabaseWriter is the database writer for an AgentMetadataIndexer.
type AgentMetadataIndexerDatabaseWriter interface {
	SetMetadata(addr [32]byte, meta AgentMetadata) error
	SetLastIndexedBlock(block uint64) error
}

// AgentMetadataIndexerDatabase is the database for an AgentMetadataIndexer.
type AgentMetadataIndexerDatabase interface {
	AgentMetadataIndexerDatabaseReader
	AgentMetadataIndexerDatabaseWriter
}

// AgentMetadataIndexerDatabaseInMemory is an in-memory implementation of AgentMetadataIndexerDatabase.
type AgentMetadataIndexerDatabaseInMemory struct {
	metadata         map[[32]byte]AgentMetadata
	lastIndexedBlock uint64
}

// AgentMetadataIndexerDatabase is the interface for an AgentMetadataIndexerDatabase.
var _ AgentMetadataIndexerDatabase = (*AgentMetadataIndexerDatabaseInMemory)(nil)

// NewAgentMetadataIndexerDatabaseInMemory creates a new in-memory AgentMetadataIndexerDatabase.
func NewAgentMetadataIndexerDatabaseInMemory(initialBlock uint64) *AgentMetadataIndexerDatabaseInMemory {
	return &AgentMetadataIndexerDatabaseInMemory{
		metadata:         make(map[[32]byte]AgentMetadata),
		lastIndexedBlock: initialBlock,
	}
}

// GetMetadata returns the AgentMetadata for a given address.
func (db *AgentMetadataIndexerDatabaseInMemory) GetMetadata(addr [32]byte) (AgentMetadata, bool) {
	meta, ok := db.metadata[addr]
	return meta, ok
}

// SetMetadata sets the AgentMetadata for a given address.
func (db *AgentMetadataIndexerDatabaseInMemory) SetMetadata(addr [32]byte, meta AgentMetadata) error {
	db.metadata[addr] = meta
	return nil
}

// GetLastIndexedBlock returns the last indexed block.
func (db *AgentMetadataIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

// SetLastIndexedBlock sets the last indexed block.
func (db *AgentMetadataIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) error {
	db.lastIndexedBlock = block
	return nil
}
