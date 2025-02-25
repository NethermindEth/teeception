package validation

import (
	"context"
	"log/slog"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/teeception/pkg/agent/chat"
)

// NameCache provides a cache for agent name validation results.
// It uses a worker to process validation requests from a queue.
type NameCache struct {
	mu               sync.RWMutex
	validNames       map[string]bool
	validationCh     chan string
	chatCompletion   chat.ChatCompletion
	concurrencyLimit int
}

// NewNameCache creates a new name cache with the given chat completion instance.
func NewNameCache(chatCompletion chat.ChatCompletion) *NameCache {
	return NewNameCacheWithConcurrency(chatCompletion, 1)
}

// NewNameCacheWithConcurrency creates a new name cache with the given chat completion instance
// and a specified concurrency limit for validation workers.
func NewNameCacheWithConcurrency(chatCompletion chat.ChatCompletion, concurrencyLimit int) *NameCache {
	if concurrencyLimit < 1 {
		concurrencyLimit = 1
	}

	cache := &NameCache{
		validNames:       make(map[string]bool),
		validationCh:     make(chan string, 200),
		chatCompletion:   chatCompletion,
		concurrencyLimit: concurrencyLimit,
	}

	return cache
}

// Run starts the main validation worker in a goroutine. It returns after spawning
// so that you can manage it externally via context cancellation or wait-group.
func (c *NameCache) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)

	// Start multiple workers based on concurrency limit
	for i := 0; i < c.concurrencyLimit; i++ {
		g.Go(func() error {
			return c.run(ctx)
		})
	}

	return g.Wait()
}

// run is the internal implementation of the validation worker
func (c *NameCache) run(ctx context.Context) error {
	slog.Info("starting NameCache validation worker")

	for {
		select {
		case name := <-c.validationCh:
			valid, err := c.chatCompletion.ValidateName(ctx, name)

			if err != nil {
				slog.Error("failed to validate name", "name", name, "error", err)
				continue
			}

			slog.Info("validated agent name", "name", name, "valid", valid)

			c.mu.Lock()
			c.validNames[name] = valid
			c.mu.Unlock()

		case <-ctx.Done():
			slog.Info("stopping NameCache validation worker")
			return ctx.Err()
		}
	}
}

// IsValid checks if a name is valid according to the cache.
// If the name is not in the cache, it enqueues it for validation
// and returns true (considering it valid until proven otherwise).
func (c *NameCache) IsValid(name string) bool {
	c.mu.RLock()
	if valid, exists := c.validNames[name]; exists {
		c.mu.RUnlock()
		return valid
	}
	c.mu.RUnlock()

	// Name not in cache, enqueue for validation
	c.EnqueueForValidation(name)
	return true // Consider names as valid until proven otherwise
}

// EnqueueForValidation adds a name to the validation queue.
func (c *NameCache) EnqueueForValidation(name string) {
	// Try to send to channel without blocking
	select {
	case c.validationCh <- name:
		// Successfully enqueued
	default:
		// Queue is full, could log this or handle differently
		slog.Warn("validation queue is full, skipping validation for name", "name", name)
	}
}

// SetValidity manually sets the validity of a name in the cache.
func (c *NameCache) SetValidity(name string, valid bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.validNames[name] = valid
}
