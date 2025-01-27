package indexer

// AgentIndexerDatabaseReader is the database reader for an AgentIndexer.
type AgentIndexerDatabaseReader interface {
	GetAgentInfo(addr [32]byte) (AgentInfo, bool)
	GetAddressesByCreator(creator [32]byte) [][32]byte
	GetAddresses() [][32]byte
	GetLastIndexedBlock() uint64
}

// AgentIndexerDatabaseWriter is the database writer for an AgentIndexer.
type AgentIndexerDatabaseWriter interface {
	SetAgentInfo(addr [32]byte, info AgentInfo) error
	SetLastIndexedBlock(block uint64) error
}

// AgentIndexerDatabase is the database for an AgentIndexer.
type AgentIndexerDatabase interface {
	AgentIndexerDatabaseReader
	AgentIndexerDatabaseWriter
}

// AgentIndexerDatabaseInMemory is an in-memory implementation of the AgentIndexerDatabase interface.
type AgentIndexerDatabaseInMemory struct {
	agents             map[[32]byte]AgentInfo
	addressesByCreator map[[32]byte][][32]byte
	addresses          [][32]byte
	lastIndexedBlock   uint64
}

var _ AgentIndexerDatabase = (*AgentIndexerDatabaseInMemory)(nil)

// NewAgentIndexerDatabaseInMemory creates a new in-memory AgentIndexerDatabase.
func NewAgentIndexerDatabaseInMemory(initialBlock uint64) *AgentIndexerDatabaseInMemory {
	return &AgentIndexerDatabaseInMemory{
		agents:             make(map[[32]byte]AgentInfo),
		addressesByCreator: make(map[[32]byte][][32]byte),
		addresses:          make([][32]byte, 0),
		lastIndexedBlock:   initialBlock,
	}
}

// GetAgentInfo returns an agent's info, if it exists.
func (db *AgentIndexerDatabaseInMemory) GetAgentInfo(addr [32]byte) (AgentInfo, bool) {
	info, ok := db.agents[addr]
	return info, ok
}

// SetAgentInfo sets an agent's info.
func (db *AgentIndexerDatabaseInMemory) SetAgentInfo(addr [32]byte, info AgentInfo) error {
	db.agents[addr] = info
	db.addresses = append(db.addresses, addr)
	db.addressesByCreator[info.Creator.Bytes()] = append(db.addressesByCreator[info.Creator.Bytes()], addr)

	return nil
}

// GetAddressesByCreator returns the addresses created by a given creator.
func (db *AgentIndexerDatabaseInMemory) GetAddressesByCreator(creator [32]byte) [][32]byte {
	return db.addressesByCreator[creator]
}

// GetAddresses returns all addresses.
func (db *AgentIndexerDatabaseInMemory) GetAddresses() [][32]byte {
	return db.addresses
}

// GetLastIndexedBlock returns the last indexed block.
func (db *AgentIndexerDatabaseInMemory) GetLastIndexedBlock() uint64 {
	return db.lastIndexedBlock
}

// SetLastIndexedBlock sets the last indexed block.
func (db *AgentIndexerDatabaseInMemory) SetLastIndexedBlock(block uint64) error {
	db.lastIndexedBlock = block
	return nil
}
