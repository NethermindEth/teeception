// Package metrics provides utilities for collecting and exposing system metrics.
package metrics

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// MetricType represents the type of metric being collected
type MetricType string

const (
	// TypeLatency represents timing metrics
	TypeLatency MetricType = "latency"
	// TypeCounter represents count-based metrics
	TypeCounter MetricType = "counter"
	// TypeGauge represents current value metrics
	TypeGauge MetricType = "gauge"
)

// MetricValue represents a collected metric with its type and value
type MetricValue struct {
	Type  MetricType   `json:"type"`
	Value interface{} `json:"value"`
}

// MetricsCollector manages the collection of system metrics
type MetricsCollector struct {
	mu      sync.RWMutex
	metrics map[string]MetricValue
}

// NewMetricsCollector creates a new MetricsCollector instance
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		metrics: make(map[string]MetricValue),
	}
}

// RecordLatency records a timing metric for an operation
func (m *MetricsCollector) RecordLatency(operation string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metrics[operation+"_latency"] = MetricValue{
		Type:  TypeLatency,
		Value: duration.Milliseconds(),
	}
}

// IncrementCounter increments a counter metric
func (m *MetricsCollector) IncrementCounter(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	metric, exists := m.metrics[name+"_counter"]
	if !exists {
		metric = MetricValue{Type: TypeCounter, Value: int64(0)}
	}
	metric.Value = metric.Value.(int64) + 1
	m.metrics[name+"_counter"] = metric
}

// SetGauge sets a gauge metric to a specific value
func (m *MetricsCollector) SetGauge(name string, value interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metrics[name+"_gauge"] = MetricValue{
		Type:  TypeGauge,
		Value: value,
	}
}

// GetMetrics returns all collected metrics
func (m *MetricsCollector) GetMetrics() map[string]MetricValue {
	m.mu.RLock()
	defer m.mu.RUnlock()
	metrics := make(map[string]MetricValue, len(m.metrics))
	for k, v := range m.metrics {
		metrics[k] = v
	}
	return metrics
}

// ServeHTTP implements http.Handler for exposing metrics via HTTP
func (m *MetricsCollector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	metrics := m.GetMetrics()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// WithLatencyTracking wraps a function with latency tracking
func (m *MetricsCollector) WithLatencyTracking(operation string, fn func() error) error {
	start := time.Now()
	err := fn()
	m.RecordLatency(operation, time.Since(start))
	return err
}

// Common metric names for consistent tracking
const (
	MetricAgentOperations      = "agent_operations"
	MetricBlockchainInteraction = "blockchain_interaction"
	MetricTwitterAPI           = "twitter_api"
	MetricSetupProcess         = "setup_process"
)
