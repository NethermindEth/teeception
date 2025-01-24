package quote

import (
	"context"
	"fmt"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
)

// TappdQuoter is a quoter that uses the Tappd API to get a quote.
type TappdQuoter struct {
	client *tappd.TappdClient
}

var _ Quoter = &TappdQuoter{}

// NewTappdQuoter creates a new TappdQuoter.
func NewTappdQuoter(client *tappd.TappdClient) *TappdQuoter {
	return &TappdQuoter{
		client: client,
	}
}

// Quote returns a quote for the given report.
func (q *TappdQuoter) Quote(ctx context.Context, report *ReportData) (string, error) {
	reportDataBytes, err := report.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("failed to binary marshal report data: %v", err)
	}

	quoteResp, err := q.client.TdxQuoteWithHashAlgorithm(ctx, reportDataBytes, tappd.KECCAK256)
	if err != nil {
		return "", fmt.Errorf("failed to get quote: %v", err)
	}

	return quoteResp.Quote, nil
}
