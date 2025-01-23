package agent

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/alitto/pond/v2"
	"github.com/sashabaranov/go-openai"

	"github.com/NethermindEth/teeception/pkg/agent/chat"
	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/NethermindEth/teeception/pkg/agent/quote"
	"github.com/NethermindEth/teeception/pkg/indexer"
	"github.com/NethermindEth/teeception/pkg/twitter"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

var (
	promptPaidSelector      = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
	getSystemPromptSelector = starknetgoutils.GetSelectorFromNameFelt("get_system_prompt")
	consumePromptSelector   = starknetgoutils.GetSelectorFromNameFelt("consume_prompt")
	transferSelector        = starknetgoutils.GetSelectorFromNameFelt("transfer")
)

const (
	TwitterClientModeEnv   = "env"
	TwitterClientModeApi   = "api"
	TwitterClientModeProxy = "proxy"
)

type AgentConfigParams struct {
	TwitterClientMode      string
	TwitterClientConfig    *twitter.TwitterClientConfig
	OpenAIKey              string
	DstackTappdEndpoint    string
	StarknetRpcUrls        []string
	StarknetPrivateKeySeed []byte
	AgentRegistryAddress   *felt.Felt
	TaskConcurrency        int
	TickRate               time.Duration
	SafeBlockDelta         uint64
}

type AgentConfig struct {
	TwitterClient       twitter.TwitterClient
	TwitterClientConfig *twitter.TwitterClientConfig

	OpenAIClient   chat.ChatCompletion
	StarknetClient starknet.ProviderWrapper
	Quoter         quote.Quoter

	AgentIndexer *indexer.AgentIndexer
	EventWatcher *indexer.EventWatcher

	Account *snaccount.StarknetAccount
	TxQueue *snaccount.TxQueue

	Pool pond.Pool

	TickRate             time.Duration
	AgentRegistryAddress *felt.Felt
}

func NewAgentConfigFromParams(params *AgentConfigParams) (*AgentConfig, error) {
	slog.Info("initializing new agent", "twitter_username", params.TwitterClientConfig.Username)

	var twitterClient twitter.TwitterClient
	if params.TwitterClientMode == "" || params.TwitterClientMode == TwitterClientModeEnv {
		params.TwitterClientMode = envGetAgentTwitterClientMode()
	}

	if params.TwitterClientMode == TwitterClientModeApi {
		twitterClient = twitter.NewTwitterApiClient()
	} else if params.TwitterClientMode == TwitterClientModeProxy {
		port, err := envLookupAgentTwitterClientPort()
		if err != nil {
			return nil, fmt.Errorf("failed to get twitter client port: %v", err)
		}
		twitterClient = twitter.NewTwitterProxy("http://localhost:"+port, http.DefaultClient)
	} else {
		return nil, fmt.Errorf("invalid twitter client mode: %s", params.TwitterClientMode)
	}

	openaiClient := chat.NewOpenAIChatCompletion(chat.OpenAIChatCompletionConfig{
		OpenAIKey: params.OpenAIKey,
		Model:     openai.GPT4,
	})

	dstackTappdClient := tappd.NewTappdClient(tappd.WithEndpoint(params.DstackTappdEndpoint))
	quoter := quote.NewTappdQuoter(dstackTappdClient)

	slog.Info("connecting to starknet", "rpc_urls", params.StarknetRpcUrls)

	providers := make([]rpc.RpcProvider, 0, len(params.StarknetRpcUrls))
	for _, url := range params.StarknetRpcUrls {
		starknetClient, err := rpc.NewProvider(url)
		if err != nil {
			return nil, err
		}
		providers = append(providers, starknetClient)
	}

	starknetClient, err := starknet.NewRateLimitedMultiProvider(starknet.RateLimitedMultiProviderConfig{
		Providers: providers,
		Limiter:   nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create rate limited client: %v", err)
	}
	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          starknetClient,
		SafeBlockDelta:  params.SafeBlockDelta,
		TickRate:        1 * time.Second,
		IndexChunkSize:  1000,
		RegistryAddress: params.AgentRegistryAddress,
	})

	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          starknetClient,
		RegistryAddress: params.AgentRegistryAddress,
	})

	privateKey := snaccount.NewPrivateKey(params.StarknetPrivateKeySeed)
	account, err := snaccount.NewStarknetAccount(privateKey)
	if err != nil {
		return nil, err
	}
	err = account.Connect(starknetClient)
	if err != nil {
		return nil, err
	}

	txQueue := snaccount.NewTxQueue(account, starknetClient, &snaccount.TxQueueConfig{
		MaxBatchSize:       10,
		SubmissionInterval: 20 * time.Second,
	})

	return &AgentConfig{
		TwitterClient:  twitterClient,
		OpenAIClient:   openaiClient,
		StarknetClient: starknetClient,
		Quoter:         quoter,

		AgentIndexer: agentIndexer,
		EventWatcher: eventWatcher,
		Account:      account,
		TxQueue:      txQueue,

		Pool: pond.NewPool(params.TaskConcurrency),

		TickRate:             params.TickRate,
		AgentRegistryAddress: params.AgentRegistryAddress,
	}, nil
}

type Agent struct {
	twitterClient       twitter.TwitterClient
	twitterClientConfig *twitter.TwitterClientConfig

	openaiClient   chat.ChatCompletion
	starknetClient starknet.ProviderWrapper
	quoter         quote.Quoter

	agentIndexer *indexer.AgentIndexer
	eventWatcher *indexer.EventWatcher

	account *snaccount.StarknetAccount
	txQueue *snaccount.TxQueue

	pool pond.Pool

	tickRate             time.Duration
	agentRegistryAddress *felt.Felt
}

func NewAgent(config *AgentConfig) (*Agent, error) {

	slog.Info("agent initialized successfully", "account_address", config.Account.Address())

	return &Agent{
		twitterClient:       config.TwitterClient,
		twitterClientConfig: config.TwitterClientConfig,

		openaiClient:   config.OpenAIClient,
		starknetClient: config.StarknetClient,
		quoter:         config.Quoter,

		agentIndexer: config.AgentIndexer,
		eventWatcher: config.EventWatcher,
		account:      config.Account,
		txQueue:      config.TxQueue,

		pool: config.Pool,

		tickRate:             config.TickRate,
		agentRegistryAddress: config.AgentRegistryAddress,
	}, nil
}

func (a *Agent) Run(ctx context.Context) error {
	slog.Info("starting agent")

	err := a.twitterClient.Initialize(a.twitterClientConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize twitter client: %v", err)
	}

	go func() {
		if err := a.eventWatcher.Run(ctx); err != nil {
			slog.Error("event watcher execution failed: %v", err)
		}
	}()

	go func() {
		if err := a.agentIndexer.Run(ctx, a.eventWatcher); err != nil {
			slog.Error("agent indexer execution failed: %v", err)
		}
	}()

	if err := a.StartServer(ctx); err != nil {
		return fmt.Errorf("failed to start server: %v", err)
	}

	promptPaidCh := make(chan *indexer.EventSubscriptionData, 1000)
	subID := a.eventWatcher.Subscribe(indexer.EventPromptPaid, promptPaidCh)
	defer a.eventWatcher.Unsubscribe(subID)

	slog.Info("entering main loop")
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(a.tickRate):
			err := a.Tick(ctx, promptPaidCh)
			if err != nil {
				slog.Warn("failed to tick", "error", err)
			}
		}
	}
}

func (a *Agent) Tick(ctx context.Context, promptPaidCh <-chan *indexer.EventSubscriptionData) error {
	go func() {
		for data := range promptPaidCh {
			for _, ev := range data.Events {
				promptPaidEvent, ok := ev.ToPromptPaidEvent()
				if !ok {
					slog.Warn("failed to convert event to prompt paid event", "event", ev)
					continue
				}

				err := a.pool.Go(func() {
					slog.Info("processing prompt paid event",
						"agent_address", ev.Raw.FromAddress,
						"from_address", promptPaidEvent.User,
						"tweet_id", promptPaidEvent.TweetID)

					err := a.processPromptPaidEvent(ctx, ev.Raw.FromAddress, promptPaidEvent, ev.Raw.BlockNumber)
					if err != nil {
						slog.Warn("failed to process prompt paid event", "error", err)
					}
				})
				if err != nil {
					slog.Warn("failed to submit task to pool", "error", err)
				}
			}
		}
	}()

	return nil
}

func (a *Agent) processPromptPaidEvent(ctx context.Context, agentAddress *felt.Felt, promptPaidEvent *indexer.PromptPaidEvent, block uint64) error {
	slog.Info("fetching tweet text", "tweet_id", promptPaidEvent.TweetID)
	tweetText, err := a.twitterClient.GetTweetText(promptPaidEvent.TweetID)
	if err != nil {
		return fmt.Errorf("failed to get tweet text: %v", err)
	}

	agentInfo, err := a.agentIndexer.GetOrFetchAgentInfo(ctx, agentAddress, block)
	if err != nil {
		return fmt.Errorf("failed to get agent info: %v", err)
	}

	return a.reactToTweet(ctx, agentInfo.Address, promptPaidEvent.TweetID, tweetText, agentInfo.SystemPrompt)
}

func (a *Agent) reactToTweet(ctx context.Context, agentAddress *felt.Felt, tweetID uint64, tweetText string, systemPrompt string) error {
	slog.Info("generating AI response", "tweet_id", tweetID)

	resp, err := a.openaiClient.Prompt(ctx, systemPrompt, tweetText)
	if err != nil {
		return fmt.Errorf("failed to generate AI response: %v", err)
	}

	slog.Info("replying to tweet", "tweet_id", tweetID)

	err = a.consumePrompt(ctx, agentAddress, tweetID)
	if err != nil {
		slog.Warn("failed to consume prompt", "error", err)
	}

	if !debug.IsDebugDisableReplies() {
		a.twitterClient.ReplyToTweet(tweetID, resp.Response)
	}

	if resp.Drain != nil {
		err := a.drainAndReply(ctx, agentAddress, resp.Drain.Address, tweetID)
		if err != nil {
			return fmt.Errorf("failed to drain and reply: %v", err)
		}
	}

	return nil
}

func (a *Agent) consumePrompt(ctx context.Context, agentAddress *felt.Felt, promptID uint64) error {
	fnCall := rpc.FunctionCall{
		ContractAddress:    a.agentRegistryAddress,
		EntryPointSelector: consumePromptSelector,
		Calldata:           []*felt.Felt{agentAddress, new(felt.Felt).SetUint64(promptID)},
	}

	ch, err := a.txQueue.Enqueue(ctx, []rpc.FunctionCall{fnCall})
	if err != nil {
		return fmt.Errorf("failed to enqueue transaction: %v", err)
	}

	go func() {
		txHash, err := snaccount.WaitForResult(ch)
		if err != nil {
			slog.Warn("failed to wait for transaction result", "error", err)
		}

		slog.Info("transaction broadcast successful", "tx_hash", txHash)
	}()

	return nil
}

func (a *Agent) drain(ctx context.Context, agentAddress *felt.Felt, addressStr string) (*felt.Felt, error) {
	slog.Info("initiating drain transaction")

	addressFelt, err := starknetgoutils.HexToFelt(addressStr)
	if err != nil {
		return nil, fmt.Errorf("failed to convert address to felt: %v", err)
	}

	fnCall := rpc.FunctionCall{
		ContractAddress:    a.agentRegistryAddress,
		EntryPointSelector: transferSelector,
		Calldata:           []*felt.Felt{agentAddress, addressFelt},
	}

	ch, err := a.txQueue.Enqueue(ctx, []rpc.FunctionCall{fnCall})
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue transaction: %v", err)
	}

	txHash, err := snaccount.WaitForResult(ch)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for transaction result: %v", err)
	}

	slog.Info("transaction broadcast successful", "tx_hash", txHash)
	return txHash, nil
}

func (a *Agent) drainAndReply(ctx context.Context, agentAddress *felt.Felt, addressStr string, tweetID uint64) error {
	txHash, err := a.drain(ctx, agentAddress, addressStr)
	if err != nil {
		return fmt.Errorf("failed to drain: %v", err)
	}

	slog.Info("draining successful", "tx_hash", txHash, "tweet_id", tweetID)

	if debug.IsDebugDisableReplies() {
		return nil
	}

	return a.twitterClient.ReplyToTweet(tweetID, fmt.Sprintf("Drained %s to %s: %s. Congratulations!", agentAddress, addressStr, txHash))
}

func (a *Agent) quote(ctx context.Context) (string, error) {
	slog.Info("requesting quote")

	quote, err := a.quoter.Quote(ctx, &quote.ReportData{
		Address:         a.account.Address(),
		ContractAddress: a.agentRegistryAddress,
		TwitterUsername: a.twitterClientConfig.Username,
	})
	if err != nil {
		return "", fmt.Errorf("failed to get quote: %v", err)
	}

	slog.Info("quote generated successfully")

	return quote, nil
}
