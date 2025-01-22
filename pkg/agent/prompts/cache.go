package prompts

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"

	"github.com/NethermindEth/juno/core/felt"

	"github.com/NethermindEth/teeception/pkg/indexer"
)

const (
	defaultPromptCacheSize = 1000
	defaultPromptCacheTTL  = 1 * time.Hour

	defaultPromptMaxLength = 5000
)

type SystemPromptCacheInitialState struct {
	PromptCache *expirable.LRU[[32]byte, string]
}

type SystemPromptCacheConfig struct {
	AgentIndexer    *indexer.AgentIndexer
	PrivateKey      *rsa.PrivateKey
	HttpClient      *http.Client
	CacheSize       int
	CacheTTL        time.Duration
	PromptMaxLength int
	InitialState    *SystemPromptCacheInitialState
}

type SystemPromptCache struct {
	mu sync.Mutex

	agentIndexer *indexer.AgentIndexer
	privateKey   *rsa.PrivateKey
	httpClient   *http.Client

	promptCache *expirable.LRU[[32]byte, string]

	promptMaxLength int
}

func NewSystemPromptCache(config *SystemPromptCacheConfig) *SystemPromptCache {
	if config.CacheSize == 0 {
		config.CacheSize = defaultPromptCacheSize
	}
	if config.CacheTTL == 0 {
		config.CacheTTL = defaultPromptCacheTTL
	}
	if config.PromptMaxLength == 0 {
		config.PromptMaxLength = defaultPromptMaxLength
	}

	if config.InitialState == nil {
		config.InitialState = &SystemPromptCacheInitialState{
			PromptCache: expirable.NewLRU[[32]byte, string](config.CacheSize, nil, config.CacheTTL),
		}
	}

	return &SystemPromptCache{
		agentIndexer:    config.AgentIndexer,
		privateKey:      config.PrivateKey,
		httpClient:      config.HttpClient,
		promptCache:     config.InitialState.PromptCache,
		promptMaxLength: config.PromptMaxLength,
	}
}

func (c *SystemPromptCache) GetOrFetchSystemPrompt(ctx context.Context, agentAddress *felt.Felt) (string, error) {
	addressBytes := agentAddress.Bytes()

	prompt, ok := c.promptCache.Get(addressBytes)
	if !ok {
		prompt, err := c.fetchSystemPrompt(ctx, agentAddress)
		if err != nil {
			return "", fmt.Errorf("failed to fetch system prompt: %w", err)
		}

		c.promptCache.Add(addressBytes, prompt)
		return prompt, nil
	}

	return prompt, nil
}

func (c *SystemPromptCache) fetchSystemPrompt(ctx context.Context, agentAddress *felt.Felt) (string, error) {
	info, err := c.agentIndexer.GetOrFetchAgentInfo(ctx, agentAddress, c.agentIndexer.GetLastIndexedBlock())
	if err != nil {
		return "", fmt.Errorf("failed to fetch agent info: %w", err)
	}

	systemPromptUri := info.SystemPromptUri

	systemPrompt, err := c.readSystemPromptFromUri(ctx, systemPromptUri)
	if err != nil {
		return "", fmt.Errorf("failed to fetch system prompt from uri: %w", err)
	}

	return systemPrompt, nil
}

func (c *SystemPromptCache) readSystemPromptFromUri(ctx context.Context, uri string) (string, error) {
	headReq, err := http.NewRequestWithContext(ctx, http.MethodHead, uri, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create HEAD request: %w", err)
	}

	headResp, err := c.httpClient.Do(headReq)
	if err != nil {
		return "", fmt.Errorf("failed to perform HEAD request: %w", err)
	}
	headResp.Body.Close()

	if headResp.ContentLength >= int64(c.promptMaxLength) {
		slog.Info("System prompt too large, skipping")
		return "", nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create GET request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to perform GET request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Attempt to decrypt body; if fail, fallback to raw body
	decryptedBody, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, c.privateKey, body, nil)
	if err != nil {
		slog.Warn("failed to decrypt body, using raw content", "error", err)
		decryptedBody = body
	}

	return string(decryptedBody), nil
}
