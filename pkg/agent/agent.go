package agent

import (
	"context"
	"crypto/rsa"
	"encoding/json"
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
	"github.com/tmc/langchaingo/jsonschema"

	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/NethermindEth/teeception/pkg/agent/prompts"
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

type AgentConfig struct {
	TwitterClientMode        string
	TwitterUsername          string
	TwitterPassword          string
	TwitterConsumerKey       string
	TwitterConsumerSecret    string
	TwitterAccessToken       string
	TwitterAccessTokenSecret string
	OpenAIKey                string
	DstackTappdEndpoint      string
	StarknetRpcUrl           string
	StarknetPrivateKeySeed   []byte
	AgentRegistryAddress     *felt.Felt
	TaskConcurrency          int
	TickRate                 time.Duration
	SafeBlockDelta           uint64
	HttpClient               *http.Client
	RsaPrivateKey            *rsa.PrivateKey
}

type Agent struct {
	config *AgentConfig

	twitterClient     twitter.TwitterClient
	openaiClient      *openai.Client
	starknetClient    *rpc.Provider
	dStackTappdClient *tappd.TappdClient

	agentIndexer      *indexer.AgentIndexer
	eventWatcher      *indexer.EventWatcher
	systemPromptCache *prompts.SystemPromptCache

	account *snaccount.StarknetAccount
	txQueue *snaccount.TxQueue

	pool pond.Pool
}

func NewAgent(config *AgentConfig) (*Agent, error) {
	slog.Info("initializing new agent", "twitter_username", config.TwitterUsername)

	var twitterClient twitter.TwitterClient
	if config.TwitterClientMode == "" || config.TwitterClientMode == TwitterClientModeEnv {
		config.TwitterClientMode = envGetAgentTwitterClientMode()
	}

	if config.TwitterClientMode == TwitterClientModeApi {
		twitterClient = twitter.NewTwitterApiClient()
	} else if config.TwitterClientMode == TwitterClientModeProxy {
		port, err := envLookupAgentTwitterClientPort()
		if err != nil {
			return nil, fmt.Errorf("failed to get twitter client port: %v", err)
		}
		twitterClient = twitter.NewTwitterProxy("http://localhost:"+port, http.DefaultClient)
	} else {
		return nil, fmt.Errorf("invalid twitter client mode: %s", config.TwitterClientMode)
	}

	openaiClient := openai.NewClient(config.OpenAIKey)

	dstackTappdClient := tappd.NewTappdClient(config.DstackTappdEndpoint, slog.Default())

	slog.Info("connecting to starknet", "rpc_url", config.StarknetRpcUrl)
	starknetClient, err := rpc.NewProvider(config.StarknetRpcUrl)
	if err != nil {
		return nil, err
	}
	rateLimitedClient := starknet.NewRateLimitedProviderWithNoLimiter(starknetClient)
	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          rateLimitedClient,
		SafeBlockDelta:  config.SafeBlockDelta,
		TickRate:        1 * time.Second,
		IndexChunkSize:  1000,
		RegistryAddress: config.AgentRegistryAddress,
	})

	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          rateLimitedClient,
		RegistryAddress: config.AgentRegistryAddress,
	})

	privateKey := snaccount.NewPrivateKey(config.StarknetPrivateKeySeed)
	account, err := snaccount.NewStarknetAccount(privateKey)
	if err != nil {
		return nil, err
	}
	err = account.Connect(starknetClient)
	if err != nil {
		return nil, err
	}

	systemPromptCache := prompts.NewSystemPromptCache(&prompts.SystemPromptCacheConfig{
		AgentIndexer: agentIndexer,
		PrivateKey:   config.RsaPrivateKey,
		HttpClient:   config.HttpClient,
	})

	slog.Info("agent initialized successfully", "account_address", account.Address())

	return &Agent{
		config: config,

		twitterClient:     twitterClient,
		openaiClient:      openaiClient,
		starknetClient:    starknetClient,
		dStackTappdClient: dstackTappdClient,

		agentIndexer:      agentIndexer,
		eventWatcher:      eventWatcher,
		systemPromptCache: systemPromptCache,
		account:           account,
		txQueue: snaccount.NewTxQueue(account, starknetClient, &snaccount.TxQueueConfig{
			MaxBatchSize:       10,
			SubmissionInterval: 20 * time.Second,
		}),

		pool: pond.NewPool(config.TaskConcurrency),
	}, nil
}

func (a *Agent) Run(ctx context.Context) error {
	slog.Info("starting agent")

	err := a.twitterClient.Initialize(twitter.TwitterClientConfig{
		Username:          a.config.TwitterUsername,
		Password:          a.config.TwitterPassword,
		ConsumerKey:       a.config.TwitterConsumerKey,
		ConsumerSecret:    a.config.TwitterConsumerSecret,
		AccessToken:       a.config.TwitterAccessToken,
		AccessTokenSecret: a.config.TwitterAccessTokenSecret,
	})
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
		case <-time.After(a.config.TickRate):
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

	systemPrompt, err := a.systemPromptCache.GetOrFetchSystemPrompt(ctx, agentInfo.Address)
	if err != nil {
		return fmt.Errorf("failed to get system prompt: %v", err)
	}

	return a.reactToTweet(ctx, agentInfo.Address, promptPaidEvent.TweetID, tweetText, systemPrompt)
}

func (a *Agent) reactToTweet(ctx context.Context, agentAddress *felt.Felt, tweetID uint64, tweetText string, systemPrompt string) error {
	slog.Info("generating AI response", "tweet_id", tweetID)

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: tweetText,
		},
	}

	resp, err := a.openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    openai.GPT4,
			Messages: messages,
			Tools: []openai.Tool{
				{
					Type: openai.ToolTypeFunction,
					Function: &openai.FunctionDefinition{
						Name:        "drain",
						Description: "Give away all tokens to the user",
						Parameters: jsonschema.Definition{
							Type: jsonschema.Object,
							Properties: map[string]jsonschema.Definition{
								"address": {
									Type:        jsonschema.String,
									Description: "The address to give the tokens to",
								},
							},
							Required: []string{"address"},
						},
					},
				},
			},
		},
	)
	if err != nil {
		return fmt.Errorf("chat completion failed: %v", err)
	}

	if len(resp.Choices) == 0 {
		return fmt.Errorf("no response received")
	}

	slog.Info("replying to tweet", "tweet_id", tweetID)

	if !debug.IsDebugDisableReplies() {
		a.twitterClient.ReplyToTweet(tweetID, resp.Choices[0].Message.Content)
	}

	for _, toolCall := range resp.Choices[0].Message.ToolCalls {
		if toolCall.Function.Name == "drain" {
			type drainArgs struct {
				Address string `json:"address"`
			}

			var args drainArgs
			json.Unmarshal([]byte(toolCall.Function.Arguments), &args)

			go func() {
				err := a.drainAndReply(ctx, agentAddress, args.Address, tweetID)
				if err != nil {
					slog.Warn("failed to drain and reply", "error", err)
				}

				err = a.consumePrompt(ctx, agentAddress, tweetID)
				if err != nil {
					slog.Warn("failed to consume prompt", "error", err)
				}
			}()

			return nil
		}
	}

	err = a.consumePrompt(ctx, agentAddress, tweetID)
	if err != nil {
		slog.Warn("failed to consume prompt", "error", err)
	}

	return nil
}

func (a *Agent) consumePrompt(ctx context.Context, agentAddress *felt.Felt, promptID uint64) error {
	fnCall := rpc.FunctionCall{
		ContractAddress:    a.config.AgentRegistryAddress,
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
		ContractAddress:    a.config.AgentRegistryAddress,
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

func (a *Agent) quote(ctx context.Context) (*tappd.TdxQuoteResponse, error) {
	slog.Info("requesting quote")

	reportData := ReportData{
		Address:         a.account.Address(),
		ContractAddress: a.config.AgentRegistryAddress,
		TwitterUsername: a.config.TwitterUsername,
	}

	reportDataBytes, err := reportData.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to binary marshal report data: %v", err)
	}

	quoteResp, err := a.dStackTappdClient.TdxQuote(ctx, reportDataBytes, tappd.KECCAK256)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote: %v", err)
	}

	slog.Info("quote received successfully")
	return quoteResp, nil
}
