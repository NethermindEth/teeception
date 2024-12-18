// Package logger provides a centralized logging configuration for the teeception system.
// It wraps the standard slog package to provide consistent logging across all components.
package logger

import (
	"io"
	"log/slog"
)

// Config holds the configuration for the logger.
// It allows specifying the log level, output destination, and format.
type Config struct {
	// Level determines the minimum severity level of messages to be logged
	Level slog.Level
	// Output specifies where the logs should be written
	Output io.Writer
	// JSONFormat determines whether logs should be formatted as JSON (true) or text (false)
	JSONFormat bool
}

// NewLogger creates a new slog.Logger with the specified configuration.
// It supports both JSON and text output formats.
func NewLogger(cfg Config) *slog.Logger {
	var handler slog.Handler
	if cfg.JSONFormat {
		handler = slog.NewJSONHandler(cfg.Output, &slog.HandlerOptions{
			Level: cfg.Level,
		})
	} else {
		handler = slog.NewTextHandler(cfg.Output, &slog.HandlerOptions{
			Level: cfg.Level,
		})
	}
	return slog.New(handler)
}

// SetDefault sets the default logger for the application.
// This affects all logging done through the slog package-level functions.
func SetDefault(cfg Config) {
	logger := NewLogger(cfg)
	slog.SetDefault(logger)
}
