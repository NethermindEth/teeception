package starknet

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
)

// TxQueueConfig holds basic configuration for batching transactions.
type TxQueueConfig struct {
	// Maximum number of function calls before forcing a batch submission.
	MaxBatchSize int

	// Time interval after which a batch submission is triggered when
	// at least one function call is queued.
	SubmissionInterval time.Duration
}

// TxQueueItem represents a single Starknet function call along with
// a mechanism to notify the submitter of completion.
type TxQueueItem struct {
	FunctionCalls []rpc.FunctionCall
	ResultChan    chan *TxQueueResult
	Context       context.Context
}

// TxQueueResult represents the result of submitting a batch, including
// a transaction hash or an error if something failed.
type TxQueueResult struct {
	TransactionHash *felt.Felt
	Err             error
}

// TxQueue manages function call batching and submission.
type TxQueue struct {
	cfg      TxQueueConfig
	account  *StarknetAccount
	client   ProviderWrapper
	itemsMu  sync.Mutex
	items    []*TxQueueItem
	submitMu sync.Mutex
	running  bool
	stopCh   chan struct{}
	ticker   *time.Ticker
	wg       sync.WaitGroup
}

// NewTxQueue initializes a TxQueue with sensible defaults if none are provided.
func NewTxQueue(account *StarknetAccount, client ProviderWrapper, cfg *TxQueueConfig) *TxQueue {
	if cfg == nil {
		cfg = &TxQueueConfig{}
	}
	if cfg.MaxBatchSize <= 0 {
		cfg.MaxBatchSize = 10
	}
	if cfg.SubmissionInterval <= 0 {
		cfg.SubmissionInterval = 20 * time.Second
	}

	return &TxQueue{
		cfg:     *cfg,
		account: account,
		client:  client,
		items:   make([]*TxQueueItem, 0),
		stopCh:  make(chan struct{}),
	}
}

// Start begins the queue’s background loop that checks for
// pending function calls and submits them as a batch.
func (q *TxQueue) Start() {
	if q.running {
		return
	}
	q.running = true

	q.ticker = time.NewTicker(q.cfg.SubmissionInterval)
	q.wg.Add(1)

	go func() {
		defer q.wg.Done()
		defer q.ticker.Stop()

		for {
			select {
			case <-q.stopCh:
				return
			case <-q.ticker.C:
				q.submitIfDue()
			}
		}
	}()
}

// Stop stops the background submission process gracefully.
func (q *TxQueue) Stop() {
	if !q.running {
		return
	}
	close(q.stopCh)
	q.wg.Wait()
	q.running = false
}

// Enqueue attempts a "call" for each function call to ensure it doesn't revert.
// If successful, the set of calls is queued for batch submission. Otherwise,
// it returns an error and does not enqueue the item.
func (q *TxQueue) Enqueue(ctx context.Context, calls []rpc.FunctionCall) (chan *TxQueueResult, error) {
	// Dry-run each FunctionCall to confirm success.
	for i, c := range calls {
		err := q.client.Do(func(client rpc.RpcProvider) error {
			_, err := client.Call(ctx, c, rpc.WithBlockTag("latest"))
			if err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("function call index %d failed simulation: %v", i, FormatRpcError(err))
		}
	}

	resultCh := make(chan *TxQueueResult, 1)

	q.itemsMu.Lock()
	q.items = append(q.items, &TxQueueItem{
		FunctionCalls: calls,
		ResultChan:    resultCh,
		Context:       ctx,
	})
	numItems := len(q.items)
	q.itemsMu.Unlock()

	// If we reached the max batch size, try a submit immediately.
	if numItems >= q.cfg.MaxBatchSize {
		q.submitIfDue()
	}

	return resultCh, nil
}

// submitIfDue checks if we have a non-empty queue and tries to submit a batch.
// It ensures that only one submission can happen at a time and no new submission
// is triggered if another submission is still in progress.
func (q *TxQueue) submitIfDue() {
	q.itemsMu.Lock()
	numItems := len(q.items)
	if numItems == 0 {
		q.itemsMu.Unlock()
		return
	}

	// Copy queue items we want to submit (all in the queue).
	toSubmit := make([]*TxQueueItem, numItems)
	copy(toSubmit, q.items)
	// Clear the queue for the next batch.
	q.items = q.items[:0]
	q.itemsMu.Unlock()

	go q.submitBatch(toSubmit)
}

// submitBatch attempts a single multicall (aggregation of all items) first. If that fails,
// it defaults to sending each item in the batch individually.
func (q *TxQueue) submitBatch(items []*TxQueueItem) {
	q.submitMu.Lock()
	defer q.submitMu.Unlock()

	slog.Info("preparing to submit batch", "calls_in_batch", len(items))

	// Flatten all function calls into a single array.
	var allCalls []rpc.FunctionCall
	for _, item := range items {
		allCalls = append(allCalls, item.FunctionCalls...)
	}

	// Attempt multicall:
	ok := q.tryMulticall(items, allCalls)
	if ok {
		return
	}

	// Otherwise, fallback to sending individually:
	slog.Warn("multicall failed, falling back to single-call submission")
	for _, item := range items {
		q.submitSingle(item)
	}
}

// tryMulticall tries to sign/broadcast all calls as a single transaction.
// If it fails at any step, returns false so we can fallback.
func (q *TxQueue) tryMulticall(items []*TxQueueItem, allCalls []rpc.FunctionCall) bool {
	acc, err := q.account.Account()
	if err != nil {
		slog.Error("failed to get account for multicall", "error", err)
		return false
	}

	nonce, err := acc.Nonce(context.Background(), rpc.WithBlockTag("latest"), q.account.Address())
	if err != nil {
		LogRpcError(err)
		slog.Error("failed to get nonce for multicall", "error", err)
		return false
	}

	invokeTxn := rpc.BroadcastInvokev1Txn{
		InvokeTxnV1: rpc.InvokeTxnV1{
			Version:       rpc.TransactionV1,
			Nonce:         nonce,
			Type:          rpc.TransactionType_Invoke,
			SenderAddress: q.account.Address(),
		},
	}

	calldata, err := acc.FmtCalldata(allCalls)
	if err != nil {
		LogRpcError(err)
		slog.Error("failed to format calldata for multicall", "error", err)
		return false
	}
	invokeTxn.Calldata = calldata

	// Estimate fee for multicall
	feeResp, err := acc.EstimateFee(context.Background(), []rpc.BroadcastTxn{invokeTxn}, []rpc.SimulationFlag{}, rpc.WithBlockTag("latest"))
	if err != nil {
		LogRpcError(err)
		slog.Error("fee estimation failed for multicall", "error", err)
		return false
	}

	fee := feeResp[0].OverallFee
	feeBI := fee.BigInt(new(big.Int))
	// Add 20% buffer
	feeBI.Add(feeBI, new(big.Int).Div(feeBI, big.NewInt(5)))
	invokeTxn.MaxFee = new(felt.Felt).SetBigInt(feeBI)

	// Sign transaction
	slog.Info("signing multicall transaction")
	err = acc.SignInvokeTransaction(context.Background(), &invokeTxn.InvokeTxnV1)
	if err != nil {
		LogRpcError(err)
		slog.Error("failed to sign multicall transaction", "error", err)
		return false
	}

	// Broadcast transaction
	slog.Info("broadcasting multicall transaction")
	resp, err := acc.AddInvokeTransaction(context.Background(), invokeTxn)
	if err != nil {
		LogRpcError(err)
		slog.Error("multicall broadcast failed", "error", err)
		return false
	}

	slog.Info("multicall broadcast successful", "tx_hash", resp.TransactionHash)
	q.notifyAll(items, resp.TransactionHash, nil)
	return true
}

// submitSingle signs and broadcasts just one TxQueueItem in its own transaction.
func (q *TxQueue) submitSingle(item *TxQueueItem) {
	acc, err := q.account.Account()
	if err != nil {
		q.notifySingle(item, nil, err)
		return
	}

	nonce, err := acc.Nonce(item.Context, rpc.WithBlockTag("latest"), q.account.Address())
	if err != nil {
		LogRpcError(err)
		q.notifySingle(item, nil, err)
		return
	}

	invokeTxn := rpc.BroadcastInvokev1Txn{
		InvokeTxnV1: rpc.InvokeTxnV1{
			Version:       rpc.TransactionV1,
			Nonce:         nonce,
			Type:          rpc.TransactionType_Invoke,
			SenderAddress: q.account.Address(),
		},
	}

	calldata, err := acc.FmtCalldata(item.FunctionCalls)
	if err != nil {
		LogRpcError(err)
		q.notifySingle(item, nil, err)
		return
	}
	invokeTxn.Calldata = calldata

	feeResp, err := acc.EstimateFee(item.Context, []rpc.BroadcastTxn{invokeTxn}, []rpc.SimulationFlag{}, rpc.WithBlockTag("latest"))
	if err != nil {
		LogRpcError(err)
		q.notifySingle(item, nil, err)
		return
	}

	fee := feeResp[0].OverallFee
	feeBI := fee.BigInt(new(big.Int))
	// Add 20% buffer
	feeBI.Add(feeBI, new(big.Int).Div(feeBI, big.NewInt(5)))
	invokeTxn.MaxFee = new(felt.Felt).SetBigInt(feeBI)

	err = acc.SignInvokeTransaction(item.Context, &invokeTxn.InvokeTxnV1)
	if err != nil {
		LogRpcError(err)
		q.notifySingle(item, nil, err)
		return
	}

	resp, err := acc.AddInvokeTransaction(item.Context, invokeTxn)
	if err != nil {
		LogRpcError(err)
		q.notifySingle(item, nil, err)
		return
	}

	q.notifySingle(item, resp.TransactionHash, nil)
}

// notifyAll notifies all queued items in this batch with a single transaction result.
func (q *TxQueue) notifyAll(items []*TxQueueItem, txHash *felt.Felt, err error) {
	for _, item := range items {
		q.notifySingle(item, txHash, err)
	}
}

// notifySingle sends the result to a single item’s ResultChan.
func (q *TxQueue) notifySingle(item *TxQueueItem, txHash *felt.Felt, err error) {
	select {
	case <-item.Context.Done():
		// Requestor gave up or timed out, ignore sending result
		return
	case item.ResultChan <- &TxQueueResult{
		TransactionHash: txHash,
		Err:             err,
	}:
	default:
		// If the channel was not being read, we skip
	}
}

// WaitForResult is a helper function that can be used by the caller to wait
// for a transaction. It returns the transaction hash (if successful) or an error.
func WaitForResult(ch chan *TxQueueResult) (*felt.Felt, error) {
	res, ok := <-ch
	if !ok {
		return nil, errors.New("result channel closed unexpectedly")
	}
	if res.Err != nil {
		return nil, res.Err
	}
	return res.TransactionHash, nil
}
