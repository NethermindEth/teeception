package quote

import (
	"context"
)

// Quoter is an interface for getting a quote.
type Quoter interface {
	Quote(ctx context.Context, report *ReportData) (string, error)
}
