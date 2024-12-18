package debug

import (
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"time"
)

// CPUProfile represents an active CPU profile
type CPUProfile struct {
	file *os.File
}

// StartCPUProfile starts CPU profiling and writes to the specified file
func StartCPUProfile(filename string) (*CPUProfile, error) {
	f, err := os.Create(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to create CPU profile file: %w", err)
	}

	if err := pprof.StartCPUProfile(f); err != nil {
		f.Close()
		return nil, fmt.Errorf("failed to start CPU profile: %w", err)
	}

	return &CPUProfile{file: f}, nil
}

// Stop stops the CPU profile and closes the file
func (p *CPUProfile) Stop() error {
	pprof.StopCPUProfile()
	if err := p.file.Close(); err != nil {
		return fmt.Errorf("failed to close CPU profile file: %w", err)
	}
	return nil
}

// WriteHeapProfile writes the heap profile to the specified file
func WriteHeapProfile(filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create heap profile file: %w", err)
	}
	defer f.Close()

	if err := pprof.WriteHeapProfile(f); err != nil {
		return fmt.Errorf("failed to write heap profile: %w", err)
	}
	return nil
}

// DumpGoroutines writes the stack traces of all current goroutines to the specified file
func DumpGoroutines(filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create goroutine dump file: %w", err)
	}
	defer f.Close()

	pprof.Lookup("goroutine").WriteTo(f, 1)
	return nil
}

// MemStats returns current memory statistics
func MemStats() runtime.MemStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m
}

// ProfileBlock enables block profiling with the specified rate
func ProfileBlock(rate int) {
	runtime.SetBlockProfileRate(rate)
}

// ProfileMutex enables mutex profiling with the specified rate
func ProfileMutex(rate int) {
	runtime.SetMutexProfileFraction(rate)
}

// WriteBlockProfile writes the block profile to the specified file
func WriteBlockProfile(filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create block profile file: %w", err)
	}
	defer f.Close()

	if err := pprof.Lookup("block").WriteTo(f, 0); err != nil {
		return fmt.Errorf("failed to write block profile: %w", err)
	}
	return nil
}

// WriteMutexProfile writes the mutex profile to the specified file
func WriteMutexProfile(filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create mutex profile file: %w", err)
	}
	defer f.Close()

	if err := pprof.Lookup("mutex").WriteTo(f, 0); err != nil {
		return fmt.Errorf("failed to write mutex profile: %w", err)
	}
	return nil
}
