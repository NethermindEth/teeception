// Package errors provides custom error types and utilities for the teeception system.
// It includes error categorization, stack trace capture, and error wrapping capabilities.
package errors

import (
	"fmt"
	"runtime"
	"strings"
)

// ErrorType represents the category of an error.
type ErrorType string

// Error types for different categories of errors in the system.
const (
	TypeValidation ErrorType = "validation"
	TypeBlockchain ErrorType = "blockchain"
	TypeTwitter    ErrorType = "twitter"
	TypeSetup      ErrorType = "setup"
	TypeAgent      ErrorType = "agent"
)

// Error represents a custom error with type information and stack trace.
type Error struct {
	Type    ErrorType // The category of the error
	Message string    // A descriptive message about the error
	Err     error     // The underlying error, if any
	Stack   string    // The stack trace at the time of error creation
}

// Error implements the error interface.
func (e *Error) Error() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("[%s] %s", e.Type, e.Message))
	if e.Err != nil {
		sb.WriteString(fmt.Sprintf(": %v", e.Err))
	}
	return sb.String()
}

// Unwrap returns the underlying error.
func (e *Error) Unwrap() error {
	return e.Err
}

// New creates a new Error with the given type, message, and optional underlying error.
// It automatically captures the stack trace at the point of creation.
func New(errType ErrorType, message string, err error) *Error {
	stack := make([]byte, 4096)
	runtime.Stack(stack, false)
	return &Error{
		Type:    errType,
		Message: message,
		Err:     err,
		Stack:   string(stack),
	}
}

// Wrap wraps an existing error with additional context and type information.
// It preserves the original error's stack trace if it's also an *Error.
func Wrap(err error, errType ErrorType, message string) *Error {
	if originalErr, ok := err.(*Error); ok {
		return &Error{
			Type:    errType,
			Message: message,
			Err:     originalErr,
			Stack:   originalErr.Stack,
		}
	}
	return New(errType, message, err)
}

// Is implements error matching for wrapped errors.
func (e *Error) Is(target error) bool {
	t, ok := target.(*Error)
	if !ok {
		return false
	}
	return e.Type == t.Type
}
