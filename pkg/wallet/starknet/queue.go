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
	Ctx           context.Context
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
	nonceMu  sync.Mutex
	nonce    *felt.Felt
	running  bool
	submitCh chan struct{}
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
		cfg:      *cfg,
		account:  account,
		client:   client,
		items:    make([]*TxQueueItem, 0),
		submitCh: make(chan struct{}, 100),
	}
}

// Run runs the queue's background loop that checks for
// pending function calls and submits them as a batch.
func (q *TxQueue) Run(ctx context.Context) error {
	if q.running {
		return nil
	}
	q.running = true
	defer func() {
		q.running = false
	}()

	// Get initial nonce
	acc, err := q.account.Account()
	if err != nil {
		return fmt.Errorf("failed to get account: %w", err)
	}
	nonce, err := acc.Nonce(ctx, rpc.WithBlockTag("pending"), q.account.Address())
	if err != nil {
		return fmt.Errorf("failed to get initial nonce: %w", FormatRpcError(err))
	}
	q.nonce = nonce

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-q.submitCh:
			q.submitIfDue(ctx)
		case <-time.After(q.cfg.SubmissionInterval):
			q.submitIfDue(ctx)
		}
	}
}

// Enqueue attempts a "call" for each function call to ensure it doesn't revert.
// If successful, the set of calls is queued for batch submission. Otherwise,
// it returns an error and does not enqueue the item.
func (q *TxQueue) Enqueue(ctx context.Context, calls []rpc.FunctionCall) (chan *TxQueueResult, error) {
	if !q.running {
		return nil, errors.New("queue is not running")
	}

	err := q.simulateBatch(ctx, calls)
	if err != nil {
		return nil, fmt.Errorf("function call failed simulation: %w", err)
	}

	resultCh := make(chan *TxQueueResult, 1)

	q.itemsMu.Lock()
	q.items = append(q.items, &TxQueueItem{
		FunctionCalls: calls,
		ResultChan:    resultCh,
		Ctx:           ctx,
	})
	numItems := len(q.items)
	// If we reached the max batch size, try a submit immediately.
	if numItems >= q.cfg.MaxBatchSize {
		select {
		case q.submitCh <- struct{}{}:
		default:
		}
	}
	q.itemsMu.Unlock()

	return resultCh, nil
}

// submitIfDue checks if we have a non-empty queue and tries to submit a batch.
// It ensures that only one submission can happen at a time and no new submission
// is triggered if another submission is still in progress.
func (q *TxQueue) submitIfDue(ctx context.Context) {
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

	go q.submitBatch(ctx, toSubmit)
}

// submitBatch attempts a single multicall (aggregation of all items) first. If that fails,
// it defaults to sending each item in the batch individually.
func (q *TxQueue) submitBatch(ctx context.Context, items []*TxQueueItem) {
	q.nonceMu.Lock()
	defer q.nonceMu.Unlock()

	slog.Info("preparing to submit batch", "calls_in_batch", len(items))

	// Flatten all function calls into a single array.
	var allCalls []rpc.FunctionCall
	for _, item := range items {
		allCalls = append(allCalls, item.FunctionCalls...)
	}

	// Attempt multicall:
	ok := q.tryMulticall(ctx, items, allCalls)
	if ok {
		return
	}

	// Otherwise, fallback to sending individually:
	slog.Warn("multicall failed, falling back to single-call submission")
	for _, item := range items {
		q.submitSingle(ctx, item)
	}
}

func (q *TxQueue) buildTx(ctx context.Context, calls []rpc.FunctionCall) (*rpc.BroadcastInvokev1Txn, error) {
	acc, err := q.account.Account()
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}

	invokeTxn := rpc.BroadcastInvokev1Txn{
		InvokeTxnV1: rpc.InvokeTxnV1{
			MaxFee:        new(felt.Felt).SetUint64(100000000000000),
			Version:       rpc.TransactionV1,
			Nonce:         q.nonce,
			Type:          rpc.TransactionType_Invoke,
			SenderAddress: q.account.Address(),
		},
	}

	calldata, err := acc.FmtCalldata(calls)
	if err != nil {
		return nil, fmt.Errorf("failed to format calldata: %w", err)
	}
	invokeTxn.Calldata = calldata

	err = acc.SignInvokeTransaction(ctx, &invokeTxn.InvokeTxnV1)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", FormatRpcError(err))
	}

	// Estimate fee for multicall
	feeResp, err := acc.EstimateFee(ctx, []rpc.BroadcastTxn{invokeTxn}, []rpc.SimulationFlag{}, rpc.WithBlockTag("pending"))
	if err != nil {
		return nil, fmt.Errorf("fee estimation failed: %w", FormatRpcError(err))
	}

	fee := feeResp[0].OverallFee
	feeBI := fee.BigInt(new(big.Int))

	// Add 20% buffer
	feeBI.Add(feeBI, new(big.Int).Div(feeBI, big.NewInt(5)))
	invokeTxn.MaxFee = new(felt.Felt).SetBigInt(feeBI)

	err = acc.SignInvokeTransaction(ctx, &invokeTxn.InvokeTxnV1)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", FormatRpcError(err))
	}

	return &invokeTxn, nil
}

// tryMulticall tries to sign/broadcast all calls as a single transaction.
// If it fails at any step, returns false so we can fallback.
func (q *TxQueue) tryMulticall(ctx context.Context, items []*TxQueueItem, allCalls []rpc.FunctionCall) bool {
	acc, err := q.account.Account()
	if err != nil {
		slog.Error("failed to get account", "error", err)
		return false
	}

	invokeTxn, err := q.buildTx(ctx, allCalls)
	if err != nil {
		slog.Error("failed to build multicall transaction", "error", err)
		return false
	}

	// Broadcast transaction
	slog.Info("broadcasting multicall transaction")
	resp, err := acc.AddInvokeTransaction(ctx, invokeTxn)
	if err != nil {
		slog.Error("multicall broadcast failed", "error", FormatRpcError(err))
		return false
	}

	// Increment nonce after successful broadcast
	q.nonce = q.nonce.Add(q.nonce, new(felt.Felt).SetUint64(1))

	slog.Info("multicall broadcast successful", "tx_hash", resp.TransactionHash)
	q.notifyAll(items, resp.TransactionHash, nil)
	return true
}

// submitSingle signs and broadcasts just one TxQueueItem in its own transaction.
func (q *TxQueue) submitSingle(ctx context.Context, item *TxQueueItem) {
	acc, err := q.account.Account()
	if err != nil {
		slog.Error("failed to get account", "error", err)
		q.notifySingle(item, nil, err)
		return
	}

	invokeTxn, err := q.buildTx(ctx, item.FunctionCalls)
	if err != nil {
		q.notifySingle(item, nil, err)
		return
	}

	resp, err := acc.AddInvokeTransaction(ctx, invokeTxn)
	if err != nil {
		q.notifySingle(item, nil, FormatRpcError(err))
		return
	}

	// Increment nonce after successful broadcast
	q.nonce = q.nonce.Add(q.nonce, new(felt.Felt).SetUint64(1))

	q.notifySingle(item, resp.TransactionHash, nil)
}

func (q *TxQueue) simulateBatch(ctx context.Context, calls []rpc.FunctionCall) error {
	q.nonceMu.Lock()
	defer q.nonceMu.Unlock()

	invokeTxn, err := q.buildTx(ctx, calls)
	if err != nil {
		return fmt.Errorf("failed to build transaction: %w", err)
	}

	err = q.client.Do(func(client rpc.RpcProvider) error {
		_, err := client.SimulateTransactions(ctx, rpc.WithBlockTag("pending"), []rpc.BroadcastTxn{*invokeTxn}, []rpc.SimulationFlag{})
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("function call failed simulation: %w", FormatRpcError(err))
	}

	return nil
}

// notifyAll notifies all queued items in this batch with a single transaction result.
func (q *TxQueue) notifyAll(items []*TxQueueItem, txHash *felt.Felt, err error) {
	for _, item := range items {
		q.notifySingle(item, txHash, err)
	}
}

// notifySingle sends the result to a single item's ResultChan.
func (q *TxQueue) notifySingle(item *TxQueueItem, txHash *felt.Felt, err error) {
	select {
	case <-item.Ctx.Done():
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
func WaitForResult(ctx context.Context, ch chan *TxQueueResult) (*felt.Felt, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res, ok := <-ch:
		if !ok {
			return nil, errors.New("result channel closed unexpectedly")
		}
		if res.Err != nil {
			return nil, res.Err
		}
		return res.TransactionHash, nil
	}
}
