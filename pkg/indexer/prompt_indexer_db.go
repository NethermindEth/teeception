package indexer

import (
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/NethermindEth/juno/core/felt"
	_ "github.com/mattn/go-sqlite3"
)

// PromptData represents a prompt and its response
type PromptData struct {
	Pending     bool
	PromptID    uint64
	AgentAddr   *felt.Felt
	IsDrain     bool
	Prompt      string
	Response    *string
	Error       *string
	BlockNumber uint64
	UserAddr    *felt.Felt
}

// PromptIndexerDatabaseReader is the database reader for a PromptIndexer
type PromptIndexerDatabaseReader interface {
	GetPrompt(promptID uint64, agentAddr *felt.Felt) (*PromptData, bool)
	GetPromptsByAgent(agentAddr *felt.Felt, from, to int) ([]*PromptData, error)
	GetPromptsByUser(userAddr *felt.Felt, from, to int) ([]*PromptData, error)
	GetPromptsByUserAndAgent(userAddr *felt.Felt, agentAddr *felt.Felt, from, to int) ([]*PromptData, error)
	GetLastIndexedBlock() uint64
}

// PromptIndexerDatabaseWriter is the database writer for a PromptIndexer
type PromptIndexerDatabaseWriter interface {
	SetPrompt(data *PromptData) error
	SetLastIndexedBlock(block uint64) error
}

// PromptIndexerDatabase is the database for a PromptIndexer
type PromptIndexerDatabase interface {
	PromptIndexerDatabaseReader
	PromptIndexerDatabaseWriter
}

// PromptIndexerDatabaseSQLite is a SQLite implementation of the PromptIndexerDatabase interface
type PromptIndexerDatabaseSQLite struct {
	db *sql.DB
}

// NewPromptIndexerDatabaseSQLite creates a new SQLite-based PromptIndexerDatabase
func NewPromptIndexerDatabaseSQLite(dbPath string) (*PromptIndexerDatabaseSQLite, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Create tables if they don't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS prompts (
			pending BOOLEAN NOT NULL,
			prompt_id INTEGER NOT NULL,
			agent_addr TEXT NOT NULL,
			is_drain BOOLEAN NOT NULL,
			prompt TEXT NOT NULL,
			response TEXT,
			error TEXT,
			block_number INTEGER NOT NULL,
			user_addr TEXT NOT NULL,
			PRIMARY KEY (prompt_id, agent_addr)
		);

		CREATE TABLE IF NOT EXISTS prompts_metadata (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return &PromptIndexerDatabaseSQLite{db: db}, nil
}

// GetPrompt returns a prompt by its ID and agent address
func (db *PromptIndexerDatabaseSQLite) GetPrompt(promptID uint64, agentAddr *felt.Felt) (*PromptData, bool) {
	var data PromptData
	var agentAddrStr, userAddrStr string
	var response, errMsg sql.NullString

	err := db.db.QueryRow(`
		SELECT pending, prompt_id, agent_addr, is_drain, prompt, response, error, block_number, user_addr
		FROM prompts
		WHERE prompt_id = ? AND agent_addr = ?
	`, promptID, agentAddr.String()).Scan(
		&data.Pending,
		&data.PromptID,
		&agentAddrStr,
		&data.IsDrain,
		&data.Prompt,
		&response,
		&errMsg,
		&data.BlockNumber,
		&userAddrStr,
	)
	if err == sql.ErrNoRows {
		return nil, false
	}
	if err != nil {
		slog.Error("failed to get prompt", "error", err)
		return nil, false
	}

	data.AgentAddr, err = new(felt.Felt).SetString(agentAddrStr)
	if err != nil {
		slog.Error("failed to set agent address", "error", err)
		return nil, false
	}
	data.UserAddr, err = new(felt.Felt).SetString(userAddrStr)
	if err != nil {
		slog.Error("failed to set user address", "error", err)
		return nil, false
	}
	if response.Valid {
		data.Response = &response.String
	}
	if errMsg.Valid {
		data.Error = &errMsg.String
	}

	return &data, true
}

// GetPromptsByAgent returns all prompts for a given agent
func (db *PromptIndexerDatabaseSQLite) GetPromptsByAgent(agentAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	query := `
		SELECT pending, prompt_id, agent_addr, is_drain, prompt, response, error, block_number, user_addr
		FROM prompts
		WHERE agent_addr = ?
		ORDER BY block_number DESC, prompt_id DESC
	`

	if from >= 0 && to >= 0 && to >= from {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", to-from, from)
	} else if to < from {
		return nil, fmt.Errorf("invalid range: 'to' (%d) must be greater than or equal to 'from' (%d)", to, from)
	}

	rows, err := db.db.Query(query, agentAddr.String())
	if err != nil {
		return nil, fmt.Errorf("failed to query prompts: %w", err)
	}
	defer rows.Close()

	prompts := make([]*PromptData, 0, to-from)
	for rows.Next() {
		var data PromptData
		var agentAddrStr, userAddrStr string
		var response, errMsg sql.NullString

		err := rows.Scan(
			&data.Pending,
			&data.PromptID,
			&agentAddrStr,
			&data.IsDrain,
			&data.Prompt,
			&response,
			&errMsg,
			&data.BlockNumber,
			&userAddrStr,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		data.AgentAddr, err = new(felt.Felt).SetString(agentAddrStr)
		if err != nil {
			slog.Error("failed to set agent address", "error", err)
			return nil, fmt.Errorf("failed to set agent address: %w", err)
		}
		data.UserAddr, err = new(felt.Felt).SetString(userAddrStr)
		if err != nil {
			slog.Error("failed to set user address", "error", err)
			return nil, fmt.Errorf("failed to set user address: %w", err)
		}
		if response.Valid {
			data.Response = &response.String
		}
		if errMsg.Valid {
			data.Error = &errMsg.String
		}

		prompts = append(prompts, &data)
	}

	return prompts, nil
}

// GetPromptsByUser returns all prompts for a given user
func (db *PromptIndexerDatabaseSQLite) GetPromptsByUser(userAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	query := `
		SELECT pending, prompt_id, agent_addr, is_drain, prompt, response, error, block_number, user_addr
		FROM prompts
		WHERE user_addr = ?
		ORDER BY block_number DESC, prompt_id DESC
	`

	if from >= 0 && to >= 0 && to >= from {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", to-from, from)
	} else if to < from {
		return nil, fmt.Errorf("invalid range: 'to' (%d) must be greater than or equal to 'from' (%d)", to, from)
	}

	rows, err := db.db.Query(query, userAddr.String())
	if err != nil {
		return nil, fmt.Errorf("failed to query prompts: %w", err)
	}
	defer rows.Close()

	prompts := make([]*PromptData, 0, to-from)
	for rows.Next() {
		var data PromptData
		var agentAddrStr, userAddrStr string
		var response, errMsg sql.NullString

		err := rows.Scan(
			&data.Pending,
			&data.PromptID,
			&agentAddrStr,
			&data.IsDrain,
			&data.Prompt,
			&response,
			&errMsg,
			&data.BlockNumber,
			&userAddrStr,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		data.AgentAddr, err = new(felt.Felt).SetString(agentAddrStr)
		if err != nil {
			slog.Error("failed to set agent address", "error", err)
			return nil, fmt.Errorf("failed to set agent address: %w", err)
		}
		data.UserAddr, err = new(felt.Felt).SetString(userAddrStr)
		if err != nil {
			slog.Error("failed to set user address", "error", err)
			return nil, fmt.Errorf("failed to set user address: %w", err)
		}
		if response.Valid {
			data.Response = &response.String
		}
		if errMsg.Valid {
			data.Error = &errMsg.String
		}

		prompts = append(prompts, &data)
	}

	return prompts, nil
}

// GetPromptsByUserAndAgent returns all prompts for a given user and agent
func (db *PromptIndexerDatabaseSQLite) GetPromptsByUserAndAgent(userAddr *felt.Felt, agentAddr *felt.Felt, from, to int) ([]*PromptData, error) {
	query := `
		SELECT pending, prompt_id, agent_addr, is_drain, prompt, response, error, block_number, user_addr
		FROM prompts
		WHERE user_addr = ? AND agent_addr = ?
		ORDER BY block_number DESC, prompt_id DESC
	`

	if from >= 0 && to >= 0 && to >= from {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", to-from, from)
	} else if to < from {
		return nil, fmt.Errorf("invalid range: 'to' (%d) must be greater than or equal to 'from' (%d)", to, from)
	}

	rows, err := db.db.Query(query, userAddr.String(), agentAddr.String())
	if err != nil {
		return nil, fmt.Errorf("failed to query prompts: %w", err)
	}
	defer rows.Close()

	prompts := make([]*PromptData, 0, to-from)
	for rows.Next() {
		var data PromptData
		var agentAddrStr, userAddrStr string
		var response, errMsg sql.NullString

		err := rows.Scan(
			&data.Pending,
			&data.PromptID,
			&agentAddrStr,
			&data.IsDrain,
			&data.Prompt,
			&response,
			&errMsg,
			&data.BlockNumber,
			&userAddrStr,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		data.AgentAddr, err = new(felt.Felt).SetString(agentAddrStr)
		if err != nil {
			slog.Error("failed to set agent address", "error", err)
			return nil, fmt.Errorf("failed to set agent address: %w", err)
		}
		data.UserAddr, err = new(felt.Felt).SetString(userAddrStr)
		if err != nil {
			slog.Error("failed to set user address", "error", err)
			return nil, fmt.Errorf("failed to set user address: %w", err)
		}
		if response.Valid {
			data.Response = &response.String
		}
		if errMsg.Valid {
			data.Error = &errMsg.String
		}

		prompts = append(prompts, &data)
	}

	return prompts, nil
}

// SetPrompt stores a prompt in the database
func (db *PromptIndexerDatabaseSQLite) SetPrompt(data *PromptData) error {
	var responseStr, errorStr string
	if data.Response != nil {
		responseStr = *data.Response
	}
	if data.Error != nil {
		errorStr = *data.Error
	}

	_, err := db.db.Exec(`
		INSERT OR REPLACE INTO prompts (
			pending, prompt_id, agent_addr, is_drain, prompt, response, error, block_number, user_addr
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		data.Pending,
		data.PromptID,
		data.AgentAddr.String(),
		data.IsDrain,
		data.Prompt,
		sql.NullString{String: responseStr, Valid: data.Response != nil},
		sql.NullString{String: errorStr, Valid: data.Error != nil},
		data.BlockNumber,
		data.UserAddr.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to insert prompt: %w", err)
	}

	return nil
}

// GetLastIndexedBlock returns the last indexed block
func (db *PromptIndexerDatabaseSQLite) GetLastIndexedBlock() uint64 {
	var block uint64
	err := db.db.QueryRow("SELECT value FROM prompts_metadata WHERE key = 'last_indexed_block'").Scan(&block)
	if err == sql.ErrNoRows {
		return 0
	}
	if err != nil {
		slog.Error("failed to get last indexed block", "error", err)
		return 0
	}
	return block
}

// SetLastIndexedBlock sets the last indexed block
func (db *PromptIndexerDatabaseSQLite) SetLastIndexedBlock(block uint64) error {
	_, err := db.db.Exec(`
		INSERT OR REPLACE INTO prompts_metadata (key, value)
		VALUES ('last_indexed_block', ?)
	`, block)
	if err != nil {
		return fmt.Errorf("failed to set last indexed block: %w", err)
	}
	return nil
}
