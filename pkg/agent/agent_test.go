package agent_test

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/curve"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/starknet.go/utils"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"

	"github.com/NethermindEth/teeception/pkg/agent"
	"github.com/NethermindEth/teeception/pkg/agent/chat"
	"github.com/NethermindEth/teeception/pkg/agent/quote"
	"github.com/NethermindEth/teeception/pkg/indexer"
	"github.com/NethermindEth/teeception/pkg/twitter"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

type MockTwitterClientMethods struct {
	Initialize   func(config *twitter.TwitterClientConfig) error
	GetTweetText func(tweetID uint64) (string, error)
	ReplyToTweet func(tweetID uint64, reply string) error
}

type MockTwitterClient struct {
	Methods MockTwitterClientMethods
}

func (m *MockTwitterClient) Initialize(config *twitter.TwitterClientConfig) error {
	return m.Methods.Initialize(config)
}

func (m *MockTwitterClient) GetTweetText(tweetID uint64) (string, error) {
	return m.Methods.GetTweetText(tweetID)
}

func (m *MockTwitterClient) ReplyToTweet(tweetID uint64, reply string) error {
	return m.Methods.ReplyToTweet(tweetID, reply)
}

type MockChatCompletionMethods struct {
	Prompt func(ctx context.Context, systemPrompt, prompt string) (*chat.ChatCompletionResponse, error)
}

type MockChatCompletion struct {
	Methods MockChatCompletionMethods
}

func (m *MockChatCompletion) Prompt(ctx context.Context, systemPrompt, prompt string) (*chat.ChatCompletionResponse, error) {
	return m.Methods.Prompt(ctx, systemPrompt, prompt)
}

type MockProviderMethods struct {
	AddInvokeTransaction         func(ctx context.Context, invokeTxn rpc.BroadcastInvokeTxnType) (*rpc.AddInvokeTransactionResponse, error)
	AddDeclareTransaction        func(ctx context.Context, declareTransaction rpc.BroadcastDeclareTxnType) (*rpc.AddDeclareTransactionResponse, error)
	AddDeployAccountTransaction  func(ctx context.Context, deployAccountTransaction rpc.BroadcastAddDeployTxnType) (*rpc.AddDeployAccountTransactionResponse, error)
	BlockHashAndNumber           func(ctx context.Context) (*rpc.BlockHashAndNumberOutput, error)
	BlockNumber                  func(ctx context.Context) (uint64, error)
	BlockTransactionCount        func(ctx context.Context, blockID rpc.BlockID) (uint64, error)
	BlockWithTxHashes            func(ctx context.Context, blockID rpc.BlockID) (interface{}, error)
	BlockWithTxs                 func(ctx context.Context, blockID rpc.BlockID) (interface{}, error)
	Call                         func(ctx context.Context, call rpc.FunctionCall, block rpc.BlockID) ([]*felt.Felt, error)
	ChainID                      func(ctx context.Context) (string, error)
	Class                        func(ctx context.Context, blockID rpc.BlockID, classHash *felt.Felt) (rpc.ClassOutput, error)
	ClassAt                      func(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (rpc.ClassOutput, error)
	ClassHashAt                  func(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (*felt.Felt, error)
	EstimateFee                  func(ctx context.Context, requests []rpc.BroadcastTxn, simulationFlags []rpc.SimulationFlag, blockID rpc.BlockID) ([]rpc.FeeEstimation, error)
	EstimateMessageFee           func(ctx context.Context, msg rpc.MsgFromL1, blockID rpc.BlockID) (*rpc.FeeEstimation, error)
	Events                       func(ctx context.Context, input rpc.EventsInput) (*rpc.EventChunk, error)
	BlockWithReceipts            func(ctx context.Context, blockID rpc.BlockID) (interface{}, error)
	GetTransactionStatus         func(ctx context.Context, transactionHash *felt.Felt) (*rpc.TxnStatusResp, error)
	Nonce                        func(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (*felt.Felt, error)
	SimulateTransactions         func(ctx context.Context, blockID rpc.BlockID, txns []rpc.BroadcastTxn, simulationFlags []rpc.SimulationFlag) ([]rpc.SimulatedTransaction, error)
	StateUpdate                  func(ctx context.Context, blockID rpc.BlockID) (*rpc.StateUpdateOutput, error)
	StorageAt                    func(ctx context.Context, contractAddress *felt.Felt, key string, blockID rpc.BlockID) (string, error)
	SpecVersion                  func(ctx context.Context) (string, error)
	Syncing                      func(ctx context.Context) (*rpc.SyncStatus, error)
	TraceBlockTransactions       func(ctx context.Context, blockID rpc.BlockID) ([]rpc.Trace, error)
	TransactionByBlockIdAndIndex func(ctx context.Context, blockID rpc.BlockID, index uint64) (*rpc.BlockTransaction, error)
	TransactionByHash            func(ctx context.Context, hash *felt.Felt) (*rpc.BlockTransaction, error)
	TransactionReceipt           func(ctx context.Context, transactionHash *felt.Felt) (*rpc.TransactionReceiptWithBlockInfo, error)
	TraceTransaction             func(ctx context.Context, transactionHash *felt.Felt) (rpc.TxnTrace, error)
}

type MockProvider struct {
	Methods MockProviderMethods
}

func (m *MockProvider) AddInvokeTransaction(ctx context.Context, invokeTxn rpc.BroadcastInvokeTxnType) (*rpc.AddInvokeTransactionResponse, error) {
	return m.Methods.AddInvokeTransaction(ctx, invokeTxn)
}
func (m *MockProvider) AddDeclareTransaction(ctx context.Context, declareTransaction rpc.BroadcastDeclareTxnType) (*rpc.AddDeclareTransactionResponse, error) {
	return m.Methods.AddDeclareTransaction(ctx, declareTransaction)
}

func (m *MockProvider) AddDeployAccountTransaction(ctx context.Context, deployAccountTransaction rpc.BroadcastAddDeployTxnType) (*rpc.AddDeployAccountTransactionResponse, error) {
	return m.Methods.AddDeployAccountTransaction(ctx, deployAccountTransaction)
}

func (m *MockProvider) BlockHashAndNumber(ctx context.Context) (*rpc.BlockHashAndNumberOutput, error) {
	return m.Methods.BlockHashAndNumber(ctx)
}

func (m *MockProvider) BlockNumber(ctx context.Context) (uint64, error) {
	return m.Methods.BlockNumber(ctx)
}

func (m *MockProvider) BlockTransactionCount(ctx context.Context, blockID rpc.BlockID) (uint64, error) {
	return m.Methods.BlockTransactionCount(ctx, blockID)
}

func (m *MockProvider) BlockWithTxHashes(ctx context.Context, blockID rpc.BlockID) (interface{}, error) {
	return m.Methods.BlockWithTxHashes(ctx, blockID)
}

func (m *MockProvider) BlockWithTxs(ctx context.Context, blockID rpc.BlockID) (interface{}, error) {
	return m.Methods.BlockWithTxs(ctx, blockID)
}

func (m *MockProvider) Call(ctx context.Context, call rpc.FunctionCall, block rpc.BlockID) ([]*felt.Felt, error) {
	return m.Methods.Call(ctx, call, block)
}

func (m *MockProvider) ChainID(ctx context.Context) (string, error) {
	return m.Methods.ChainID(ctx)
}

func (m *MockProvider) Class(ctx context.Context, blockID rpc.BlockID, classHash *felt.Felt) (rpc.ClassOutput, error) {
	return m.Methods.Class(ctx, blockID, classHash)
}

func (m *MockProvider) ClassAt(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (rpc.ClassOutput, error) {
	return m.Methods.ClassAt(ctx, blockID, contractAddress)
}

func (m *MockProvider) ClassHashAt(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (*felt.Felt, error) {
	return m.Methods.ClassHashAt(ctx, blockID, contractAddress)
}

func (m *MockProvider) EstimateFee(ctx context.Context, requests []rpc.BroadcastTxn, simulationFlags []rpc.SimulationFlag, blockID rpc.BlockID) ([]rpc.FeeEstimation, error) {
	return m.Methods.EstimateFee(ctx, requests, simulationFlags, blockID)
}

func (m *MockProvider) EstimateMessageFee(ctx context.Context, msg rpc.MsgFromL1, blockID rpc.BlockID) (*rpc.FeeEstimation, error) {
	return m.Methods.EstimateMessageFee(ctx, msg, blockID)
}

func (m *MockProvider) Events(ctx context.Context, input rpc.EventsInput) (*rpc.EventChunk, error) {
	return m.Methods.Events(ctx, input)
}

func (m *MockProvider) BlockWithReceipts(ctx context.Context, blockID rpc.BlockID) (interface{}, error) {
	return m.Methods.BlockWithReceipts(ctx, blockID)
}

func (m *MockProvider) GetTransactionStatus(ctx context.Context, transactionHash *felt.Felt) (*rpc.TxnStatusResp, error) {
	return m.Methods.GetTransactionStatus(ctx, transactionHash)
}

func (m *MockProvider) Nonce(ctx context.Context, blockID rpc.BlockID, contractAddress *felt.Felt) (*felt.Felt, error) {
	return m.Methods.Nonce(ctx, blockID, contractAddress)
}

func (m *MockProvider) SimulateTransactions(ctx context.Context, blockID rpc.BlockID, txns []rpc.BroadcastTxn, simulationFlags []rpc.SimulationFlag) ([]rpc.SimulatedTransaction, error) {
	return m.Methods.SimulateTransactions(ctx, blockID, txns, simulationFlags)
}

func (m *MockProvider) StateUpdate(ctx context.Context, blockID rpc.BlockID) (*rpc.StateUpdateOutput, error) {
	return m.Methods.StateUpdate(ctx, blockID)
}

func (m *MockProvider) StorageAt(ctx context.Context, contractAddress *felt.Felt, key string, blockID rpc.BlockID) (string, error) {
	return m.Methods.StorageAt(ctx, contractAddress, key, blockID)
}

func (m *MockProvider) SpecVersion(ctx context.Context) (string, error) {
	return m.Methods.SpecVersion(ctx)
}

func (m *MockProvider) Syncing(ctx context.Context) (*rpc.SyncStatus, error) {
	return m.Methods.Syncing(ctx)
}

func (m *MockProvider) TraceBlockTransactions(ctx context.Context, blockID rpc.BlockID) ([]rpc.Trace, error) {
	return m.Methods.TraceBlockTransactions(ctx, blockID)
}

func (m *MockProvider) TransactionByBlockIdAndIndex(ctx context.Context, blockID rpc.BlockID, index uint64) (*rpc.BlockTransaction, error) {
	return m.Methods.TransactionByBlockIdAndIndex(ctx, blockID, index)
}

func (m *MockProvider) TransactionByHash(ctx context.Context, hash *felt.Felt) (*rpc.BlockTransaction, error) {
	return m.Methods.TransactionByHash(ctx, hash)
}

func (m *MockProvider) TransactionReceipt(ctx context.Context, transactionHash *felt.Felt) (*rpc.TransactionReceiptWithBlockInfo, error) {
	return m.Methods.TransactionReceipt(ctx, transactionHash)
}

func (m *MockProvider) TraceTransaction(ctx context.Context, transactionHash *felt.Felt) (rpc.TxnTrace, error) {
	return m.Methods.TraceTransaction(ctx, transactionHash)
}

type MockProviderWrapper struct {
	mu            sync.Mutex
	mockProviders []rpc.RpcProvider
}

func (m *MockProviderWrapper) AddProvider(provider rpc.RpcProvider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.mockProviders = append(m.mockProviders, provider)
}

func (m *MockProviderWrapper) GetProvider() rpc.RpcProvider {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.mockProviders) == 0 {
		return nil
	}
	return m.mockProviders[0]
}

func (m *MockProviderWrapper) ClearProviders() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.mockProviders = []rpc.RpcProvider{}
}

func (m *MockProviderWrapper) Do(f func(provider rpc.RpcProvider) error) error {
	var errs []error

	for idx, provider := range m.mockProviders {
		err := f(provider)
		if err != nil {
			slog.Debug("failed to execute function for provider", "error", err, "provider_index", idx)
			errs = append(errs, err)
		} else {
			slog.Debug("successfully executed function for provider", "provider_index", idx)
			return nil
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to execute function for all providers: %v", errs)
	}

	return nil
}

type MockQuoterMethods struct {
	Quote func(ctx context.Context, report *quote.ReportData) (string, error)
}

type MockQuoter struct {
	Methods MockQuoterMethods
}

func (m *MockQuoter) Quote(ctx context.Context, report *quote.ReportData) (string, error) {
	return m.Methods.Quote(ctx, report)
}

type MockNetworkCallOutput struct {
	BlockNumber  uint64
	RevertError  error
	ReturnResult []*felt.Felt
	Callback     func()
}

type MockNetwork struct {
	mu          sync.Mutex
	blockNumber uint64
	logs        map[uint64][]rpc.EmittedEvent
	callOutputs map[[32]byte][]MockNetworkCallOutput
}

func (m *MockNetwork) BlockNumber() (uint64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.blockNumber, nil
}

func (m *MockNetwork) SetBlockNumber(blockNumber uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.blockNumber = blockNumber
}

func (m *MockNetwork) GetLogs(eventsInput rpc.EventsInput) ([]rpc.EmittedEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.logs == nil {
		m.logs = make(map[uint64][]rpc.EmittedEvent)
	}

	filterLog := func(log rpc.EmittedEvent) bool {
		if eventsInput.Address != nil {
			if log.FromAddress.Cmp(eventsInput.Address) != 0 {
				return false
			}
		}

		// compare keys
		if eventsInput.Keys != nil {
			for i, keys := range eventsInput.Keys {
				if i >= len(log.Keys) {
					return false
				}

				logKey := log.Keys[i]

				ok := false
				for _, key := range keys {
					if logKey.Cmp(key) == 0 {
						ok = true
						break
					}
				}

				if !ok {
					return false
				}
			}
		}

		return true
	}

	logs := []rpc.EmittedEvent{}
	for blockNumber := *eventsInput.FromBlock.Number; blockNumber <= *eventsInput.ToBlock.Number; blockNumber++ {
		blockLogs, ok := m.logs[blockNumber]
		if !ok {
			continue
		}

		for _, log := range blockLogs {
			if filterLog(log) {
				logs = append(logs, log)
			}
		}
	}

	return logs, nil
}

func (m *MockNetwork) SetLogs(blockNumber uint64, logs []rpc.EmittedEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.logs[blockNumber] = logs
}

func hashCall(call rpc.FunctionCall) [32]byte {
	var byt []byte
	byt = append(byt, call.ContractAddress.Marshal()...)
	byt = append(byt, call.EntryPointSelector.Marshal()...)
	for _, calldata := range call.Calldata {
		byt = append(byt, calldata.Marshal()...)
	}
	return [32]byte(starknetgoutils.Keccak256(byt))
}

func (m *MockNetwork) SetCallOutput(call rpc.FunctionCall, output MockNetworkCallOutput) {
	m.mu.Lock()
	defer m.mu.Unlock()

	slog.Info("setting call output", "call", call, "output", output)

	if m.callOutputs == nil {
		m.callOutputs = make(map[[32]byte][]MockNetworkCallOutput)
	}

	callOutputs, ok := m.callOutputs[hashCall(call)]
	if !ok {
		callOutputs = []MockNetworkCallOutput{}
	}

	callOutputs = append(callOutputs, output)
	m.callOutputs[hashCall(call)] = callOutputs
}

func (m *MockNetwork) GetCallOutput(call rpc.FunctionCall, blockNumber uint64) (MockNetworkCallOutput, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	hash := hashCall(call)
	callOutputs, ok := m.callOutputs[hash]
	if !ok {
		return MockNetworkCallOutput{}, false
	}

	slices.SortFunc(callOutputs, func(a, b MockNetworkCallOutput) int {
		return int(a.BlockNumber - b.BlockNumber)
	})

	if len(callOutputs) == 0 {
		return MockNetworkCallOutput{}, false
	}

	if callOutputs[0].BlockNumber > blockNumber {
		return MockNetworkCallOutput{}, false
	}

	for _, callOutput := range callOutputs {
		if callOutput.BlockNumber >= blockNumber {
			return callOutput, true
		}
	}

	return MockNetworkCallOutput{}, false
}

func NewMockProviderFromNetwork(network *MockNetwork) *MockProvider {
	return &MockProvider{
		Methods: MockProviderMethods{
			BlockNumber: func(_ context.Context) (uint64, error) {
				return network.BlockNumber()
			},
			Events: func(_ context.Context, input rpc.EventsInput) (*rpc.EventChunk, error) {
				logs, err := network.GetLogs(input)
				if err != nil {
					return nil, err
				}
				return &rpc.EventChunk{
					Events: logs,
				}, nil
			},
			Call: func(ctx context.Context, call rpc.FunctionCall, block rpc.BlockID) ([]*felt.Felt, error) {
				var blockNumber uint64
				if block.Number != nil {
					blockNumber = *block.Number
				} else if block.Tag == "latest" {
					latestBlockNumber, err := network.BlockNumber()
					if err != nil {
						return nil, fmt.Errorf("failed to get block number: %v", err)
					}
					blockNumber = latestBlockNumber
				} else {
					return nil, fmt.Errorf("invalid block tag: %s", block.Tag)
				}

				slog.Info("getting call output", "call", call, "block_number", blockNumber)

				callOutput, ok := network.GetCallOutput(call, blockNumber)
				if !ok {
					return nil, fmt.Errorf("call output not found")
				}
				if callOutput.RevertError != nil {
					return nil, callOutput.RevertError
				}

				if callOutput.Callback != nil {
					callOutput.Callback()
				}

				return callOutput.ReturnResult, nil
			},
		},
	}
}

type MockAgentConfigConfig struct {
	MockTwitterClient       *MockTwitterClient
	MockTwitterClientConfig *twitter.TwitterClientConfig

	MockChatCompletion  *MockChatCompletion
	MockProviderWrapper *MockProviderWrapper
	MockQuoter          *MockQuoter

	MockUserPrivateKey *felt.Felt

	MockTickRate             time.Duration
	MockAgentRegistryAddress *felt.Felt
}

func NewMockAgentConfig(config *MockAgentConfigConfig) (*agent.AgentConfig, error) {
	account, err := snaccount.NewStarknetAccount(config.MockUserPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %v", err)
	}

	txQueue := snaccount.NewTxQueue(account, config.MockProviderWrapper, &snaccount.TxQueueConfig{
		MaxBatchSize:       10,
		SubmissionInterval: 0,
	})

	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		RegistryAddress: config.MockAgentRegistryAddress,
		Client:          config.MockProviderWrapper,
	})

	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          config.MockProviderWrapper,
		SafeBlockDelta:  0,
		TickRate:        config.MockTickRate,
		IndexChunkSize:  10,
		RegistryAddress: config.MockAgentRegistryAddress,
	})

	return &agent.AgentConfig{
		TwitterClient:       config.MockTwitterClient,
		TwitterClientConfig: config.MockTwitterClientConfig,

		ChatCompletion: config.MockChatCompletion,
		StarknetClient: config.MockProviderWrapper,
		Quoter:         config.MockQuoter,

		Account: account,
		TxQueue: txQueue,

		AgentIndexer: agentIndexer,
		EventWatcher: eventWatcher,

		AgentRegistryAddress: config.MockAgentRegistryAddress,
	}, nil
}

func generateKeypair(seed []byte) (*felt.Felt, *felt.Felt, error) {
	privateKey := starknet.NewPrivateKey(seed)
	privateKeyBytes := privateKey.Bytes()
	privateKeyBI := new(big.Int).SetBytes(privateKeyBytes[:])
	pubX, _, err := curve.Curve.PrivateToPoint(privateKeyBI)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate public key: %w", err)
	}
	pubFelt := utils.BigIntToFelt(pubX)

	return privateKey, pubFelt, nil
}

func TestProcessPromptPaidEvent(t *testing.T) {
	agentRegistryAddress := new(felt.Felt).SetBytes([]byte("agent_registry"))
	agentAddress := new(felt.Felt).SetBytes([]byte("agent"))
	userPrivateKey, userAddress, err := generateKeypair([]byte("user_private_key"))
	if err != nil {
		t.Fatalf("failed to generate keypair: %v", err)
	}

	tests := []struct {
		name          string
		tweetID       uint64
		promptID      uint64
		tweetText     string
		agentName     string
		systemPrompt  string
		aiResponse    string
		expectedError bool
		twitterError  error
		promptError   error
		quoterError   error
		setupMocks    func(*MockNetwork)
	}{
		{
			name:         "successful prompt processing",
			tweetID:      0xb33f,
			promptID:     0xf00d,
			tweetText:    "Hello, AI!",
			agentName:    "test_agent",
			systemPrompt: "You are a helpful AI assistant",
			aiResponse:   "Hello! How can I help you today?",
			setupMocks: func(network *MockNetwork) {
				// Default successful setup
			},
		},
		{
			name:          "twitter get text error",
			tweetID:       0xb33f,
			promptID:      0xf00d,
			twitterError:  fmt.Errorf("failed to get tweet"),
			expectedError: true,
			setupMocks: func(network *MockNetwork) {
				// Default setup
			},
		},
		{
			name:          "chat completion error",
			tweetID:       0xb33f,
			promptID:      0xf00d,
			tweetText:     "Hello, AI!",
			promptError:   fmt.Errorf("failed to generate response"),
			expectedError: true,
			setupMocks: func(network *MockNetwork) {
				// Default setup
			},
		},
		{
			name:          "unregistered agent",
			tweetID:       0xb33f,
			promptID:      0xf00d,
			expectedError: true,
			setupMocks: func(network *MockNetwork) {
				network.SetCallOutput(rpc.FunctionCall{
					ContractAddress:    agentRegistryAddress,
					EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("is_agent_registered"),
					Calldata:           []*felt.Felt{agentAddress},
				}, MockNetworkCallOutput{
					BlockNumber:  1,
					ReturnResult: []*felt.Felt{new(felt.Felt).SetUint64(0)},
				})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			network := &MockNetwork{}
			network.SetBlockNumber(1)

			consumedPrompts := []uint64{}

			// Setup default successful mocks if no error cases
			if !tt.expectedError {
				network.SetCallOutput(rpc.FunctionCall{
					ContractAddress:    agentRegistryAddress,
					EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("is_agent_registered"),
					Calldata:           []*felt.Felt{agentAddress},
				}, MockNetworkCallOutput{
					BlockNumber:  1,
					ReturnResult: []*felt.Felt{new(felt.Felt).SetUint64(1)},
				})

				nameFelts, _ := starknetgoutils.StringToByteArrFelt(tt.agentName)
				network.SetCallOutput(rpc.FunctionCall{
					ContractAddress:    agentAddress,
					EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("get_name"),
					Calldata:           []*felt.Felt{},
				}, MockNetworkCallOutput{
					BlockNumber:  1,
					ReturnResult: nameFelts,
				})

				systemPromptFelts, _ := starknetgoutils.StringToByteArrFelt(tt.systemPrompt)
				network.SetCallOutput(rpc.FunctionCall{
					ContractAddress:    agentAddress,
					EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("get_system_prompt"),
					Calldata:           []*felt.Felt{},
				}, MockNetworkCallOutput{
					BlockNumber:  1,
					ReturnResult: systemPromptFelts,
				})

				network.SetCallOutput(rpc.FunctionCall{
					ContractAddress:    agentRegistryAddress,
					EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("consume_prompt"),
					Calldata:           []*felt.Felt{agentAddress, new(felt.Felt).SetUint64(tt.promptID)},
				}, MockNetworkCallOutput{
					BlockNumber: 1,
					Callback:    func() { consumedPrompts = append(consumedPrompts, tt.promptID) },
				})
			}

			// Apply test-specific mock setup
			if tt.setupMocks != nil {
				tt.setupMocks(network)
			}

			twitterClient := &MockTwitterClient{
				Methods: MockTwitterClientMethods{
					GetTweetText: func(tweetID uint64) (string, error) {
						if tt.twitterError != nil {
							return "", tt.twitterError
						}
						return tt.tweetText, nil
					},
					ReplyToTweet: func(tweetID uint64, reply string) error {
						return nil
					},
				},
			}

			chatCompletion := &MockChatCompletion{
				Methods: MockChatCompletionMethods{
					Prompt: func(ctx context.Context, systemPrompt, prompt string) (*chat.ChatCompletionResponse, error) {
						if tt.promptError != nil {
							return nil, tt.promptError
						}
						return &chat.ChatCompletionResponse{
							Response: tt.aiResponse,
							Drain:    nil,
						}, nil
					},
				},
			}

			quoter := &MockQuoter{
				Methods: MockQuoterMethods{
					Quote: func(ctx context.Context, report *quote.ReportData) (string, error) {
						if tt.quoterError != nil {
							return "", tt.quoterError
						}
						return "100", nil
					},
				},
			}

			provider := NewMockProviderFromNetwork(network)
			providerWrapper := &MockProviderWrapper{
				mockProviders: []rpc.RpcProvider{provider},
			}

			agentConfig, err := NewMockAgentConfig(&MockAgentConfigConfig{
				MockTwitterClient: twitterClient,
				MockTwitterClientConfig: &twitter.TwitterClientConfig{
					Username: tt.agentName,
				},
				MockChatCompletion:       chatCompletion,
				MockProviderWrapper:      providerWrapper,
				MockQuoter:               quoter,
				MockUserPrivateKey:       userPrivateKey,
				MockTickRate:             1 * time.Second,
				MockAgentRegistryAddress: agentRegistryAddress,
			})

			if err != nil {
				t.Fatalf("failed to create agent config: %v", err)
			}

			agent, err := agent.NewAgent(agentConfig)
			if err != nil {
				t.Fatalf("failed to create agent: %v", err)
			}

			err = agent.ProcessPromptPaidEvent(context.Background(), agentAddress, &indexer.PromptPaidEvent{
				User:     userAddress,
				PromptID: tt.promptID,
				TweetID:  tt.tweetID,
				Prompt:   "test prompt",
			}, 1)

			if tt.expectedError && err == nil {
				t.Error("expected error but got none")
			}
			if !tt.expectedError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
