package agent

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/alitto/pond/v2"
	"github.com/sashabaranov/go-openai"
	"golang.org/x/sync/errgroup"

	"github.com/NethermindEth/teeception/pkg/agent/chat"
	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/NethermindEth/teeception/pkg/agent/quote"
	"github.com/NethermindEth/teeception/pkg/agent/setup"
	"github.com/NethermindEth/teeception/pkg/agent/validation"
	"github.com/NethermindEth/teeception/pkg/indexer"
	"github.com/NethermindEth/teeception/pkg/twitter"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	snaccount "github.com/NethermindEth/teeception/pkg/wallet/starknet"
)

var (
	consumePromptSelector = starknetgoutils.GetSelectorFromNameFelt("consume_prompt")
	balanceOfSelector     = starknetgoutils.GetSelectorFromNameFelt("balance_of")
	ethAddress, _         = starknetgoutils.HexToFelt("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")
)

const (
	TwitterClientModeEnv   = "env"
	TwitterClientModeApi   = "api"
	TwitterClientModeProxy = "proxy"
)

type AgentConfigParams struct {
	TwitterClientMode            string
	TwitterClientConfig          *twitter.TwitterClientConfig
	IsUnencumbered               bool
	UnencumberData               *setup.UnencumberData
	OpenAIKey                    string
	DstackTappdEndpoint          string
	StarknetRpcUrls              []string
	StarknetPrivateKeySeed       []byte
	AgentRegistryAddress         *felt.Felt
	AgentRegistryDeploymentBlock uint64
	TaskConcurrency              int
	TickRate                     time.Duration
	SafeBlockDelta               uint64
	MaxSystemPromptTokens        int
	MaxPromptTokens              int
}

type AgentAccountDeploymentState struct {
	AlreadyDeployed  bool
	DeploymentErr    error
	DeployedAt       int64
	Balance          *big.Int
	BalanceUpdatedAt int64
	Waiting          bool
}

type AgentConfig struct {
	TwitterClient       twitter.TwitterClient
	TwitterClientConfig *twitter.TwitterClientConfig

	IsUnencumbered bool
	UnencumberData *setup.UnencumberData

	ChatCompletion chat.ChatCompletion
	StarknetClient starknet.ProviderWrapper
	Quoter         quote.Quoter

	AgentIndexer *indexer.AgentIndexer
	EventWatcher *indexer.EventWatcher
	NameCache    *validation.NameCache

	Account                *snaccount.StarknetAccount
	AccountDeploymentState AgentAccountDeploymentState
	TxQueue                *snaccount.TxQueue

	Pool pond.Pool

	StartupBlockNumber   uint64
	AgentRegistryAddress *felt.Felt
	AgentRegistryBlock   uint64
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

	openaiChatCompletion := chat.NewOpenAIChatCompletionOpenAI(openai.GPT4, params.OpenAIKey)
	tokenLimitChatCompletion, err := chat.NewTokenLimitChatCompletion(openaiChatCompletion, params.MaxSystemPromptTokens, params.MaxPromptTokens)
	if err != nil {
		return nil, fmt.Errorf("failed to create token limit chat completion: %v", err)
	}

	dstackTappdClient := tappd.NewTappdClient(tappd.WithEndpoint(params.DstackTappdEndpoint))
	quoter := quote.NewTappdQuoter(dstackTappdClient)

	slog.Info("connecting to starknet")

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

	eventWatcher, err := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          starknetClient,
		SafeBlockDelta:  params.SafeBlockDelta,
		TickRate:        5 * time.Second,
		StartupTickRate: 1 * time.Second,
		IndexChunkSize:  1000,
		RegistryAddress: params.AgentRegistryAddress,
		InitialState: &indexer.EventWatcherInitialState{
			LastIndexedBlock: max(params.AgentRegistryDeploymentBlock, 1) - 1,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create event watcher: %v", err)
	}

	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          starknetClient,
		RegistryAddress: params.AgentRegistryAddress,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.AgentIndexerInitialState{
			Db: indexer.NewAgentIndexerDatabaseInMemory(max(params.AgentRegistryDeploymentBlock, 1) - 1),
		},
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

	var startupBlockNumber uint64
	if err := starknetClient.Do(func(provider rpc.RpcProvider) error {
		blockNumber, err := provider.BlockNumber(context.Background())
		if err != nil {
			return err
		}
		startupBlockNumber = blockNumber
		return nil
	}); err != nil {
		return nil, fmt.Errorf("failed to get startup block number: %v", err)
	}

	nameCache := validation.NewNameCacheWithConcurrency(tokenLimitChatCompletion, 10)

	return &AgentConfig{
		TwitterClient:       twitterClient,
		TwitterClientConfig: params.TwitterClientConfig,

		IsUnencumbered: false,
		UnencumberData: params.UnencumberData,

		ChatCompletion: tokenLimitChatCompletion,
		StarknetClient: starknetClient,
		Quoter:         quoter,
		NameCache:      nameCache,

		AgentIndexer: agentIndexer,
		EventWatcher: eventWatcher,
		Account:      account,
		TxQueue:      txQueue,

		Pool: pond.NewPool(params.TaskConcurrency),

		StartupBlockNumber:   startupBlockNumber,
		AgentRegistryAddress: params.AgentRegistryAddress,
		AgentRegistryBlock:   params.AgentRegistryDeploymentBlock,
	}, nil
}

type Agent struct {
	twitterClient       twitter.TwitterClient
	twitterClientConfig *twitter.TwitterClientConfig

	isUnencumbered bool
	unencumberData *setup.UnencumberData

	chatCompletion chat.ChatCompletion
	starknetClient starknet.ProviderWrapper
	quoter         quote.Quoter

	agentIndexer *indexer.AgentIndexer
	eventWatcher *indexer.EventWatcher
	nameCache    *validation.NameCache

	account                *snaccount.StarknetAccount
	accountDeploymentState AgentAccountDeploymentState
	txQueue                *snaccount.TxQueue

	pool pond.Pool

	startupBlockNumber   uint64
	agentRegistryAddress *felt.Felt
	agentRegistryBlock   uint64

	eventCh chan *indexer.EventSubscriptionData
}

func NewAgent(config *AgentConfig) (*Agent, error) {
	slog.Info("agent initialized successfully", "account_address", config.Account.Address())

	return &Agent{
		twitterClient:       config.TwitterClient,
		twitterClientConfig: config.TwitterClientConfig,

		isUnencumbered: config.IsUnencumbered,
		unencumberData: config.UnencumberData,

		chatCompletion: config.ChatCompletion,
		starknetClient: config.StarknetClient,
		quoter:         config.Quoter,
		nameCache:      config.NameCache,

		agentIndexer:           config.AgentIndexer,
		eventWatcher:           config.EventWatcher,
		account:                config.Account,
		accountDeploymentState: config.AccountDeploymentState,
		txQueue:                config.TxQueue,

		pool: config.Pool,

		startupBlockNumber:   config.StartupBlockNumber,
		agentRegistryAddress: config.AgentRegistryAddress,
		agentRegistryBlock:   config.AgentRegistryBlock,

		eventCh: make(chan *indexer.EventSubscriptionData, 1000),
	}, nil
}

func (a *Agent) Run(ctx context.Context) error {
	slog.Info("starting agent")

	err := a.twitterClient.Initialize(a.twitterClientConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize twitter client: %w", err)
	}

	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return a.StartServer(ctx)
	})

	if !debug.IsDebugDisableWaitingForDeployment() {
		err = a.waitForAccountDeployment(ctx)
		if err != nil {
			return fmt.Errorf("failed to wait for account deployment: %w", err)
		}
	}

	g.Go(func() error {
		return a.nameCache.Run(ctx)
	})
	g.Go(func() error {
		eventSubID := a.eventWatcher.Subscribe(indexer.EventAgentRegistered|indexer.EventPromptPaid|indexer.EventPromptConsumed|indexer.EventTeeUnencumbered, a.eventCh)
		defer a.eventWatcher.Unsubscribe(eventSubID)

		return a.eventWatcher.Run(ctx)
	})
	g.Go(func() error {
		return a.agentIndexer.Run(ctx)
	})
	g.Go(func() error {
		return a.txQueue.Run(ctx)
	})
	g.Go(func() error {
		return a.ProcessEvents(ctx)
	})

	return g.Wait()
}

type agentEventStartupController struct {
	startupTasks       map[[32]byte]map[uint64]func()
	finishedStartup    bool
	startupBlockNumber uint64
	blockNumber        uint64
}

func (a *agentEventStartupController) ClearStartupTask(agentAddressBytes [32]byte, promptID uint64) {
	if _, ok := a.startupTasks[agentAddressBytes]; !ok {
		a.startupTasks[agentAddressBytes] = make(map[uint64]func())
	}

	a.startupTasks[agentAddressBytes][promptID] = nil
}

func (a *agentEventStartupController) AddStartupTask(agentAddressBytes [32]byte, promptID uint64, task func()) {
	if _, ok := a.startupTasks[agentAddressBytes]; !ok {
		a.startupTasks[agentAddressBytes] = make(map[uint64]func())
	}

	_, ok := a.startupTasks[agentAddressBytes][promptID]
	if !ok {
		a.startupTasks[agentAddressBytes][promptID] = task
	}
}

func (a *agentEventStartupController) isPastOrAtStartupBlock(block uint64) bool {
	return block >= a.startupBlockNumber
}

func (a *agentEventStartupController) SetBlockNumber(blockNumber uint64) {
	a.blockNumber = blockNumber
}

func (a *agentEventStartupController) IsStartupPhase() bool {
	return !a.isPastOrAtStartupBlock(a.blockNumber) && !a.finishedStartup
}

func (a *agentEventStartupController) ShouldFinish() bool {
	return a.isPastOrAtStartupBlock(a.blockNumber) && !a.finishedStartup
}

func (a *agentEventStartupController) FinishStartup(pool pond.Pool) {
	for _, tasks := range a.startupTasks {
		for _, task := range tasks {
			if task == nil {
				continue
			}

			err := pool.Go(task)
			if err != nil {
				slog.Error("failed to pool startup task", "error", err)
			}
		}
	}

	a.startupTasks = nil
	a.finishedStartup = true
}

func (a *Agent) ProcessEvents(ctx context.Context) error {
	startupController := &agentEventStartupController{
		startupTasks:       make(map[[32]byte]map[uint64]func()),
		finishedStartup:    false,
		startupBlockNumber: a.startupBlockNumber,
	}

	for {
		if startupController.ShouldFinish() {
			startupController.FinishStartup(a.pool)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case data := <-a.eventCh:
			for _, ev := range data.Events {
				if ev.Type == indexer.EventTeeUnencumbered {
					a.onTeeUnencumberedEvent(ev)
				} else if ev.Type == indexer.EventPromptConsumed {
					a.onPromptConsumedEvent(ev, startupController)
				} else if ev.Type == indexer.EventPromptPaid {
					a.onPromptPaidEvent(ctx, ev, startupController)
				} else if ev.Type == indexer.EventAgentRegistered {
					a.onAgentRegisteredEvent(ev, startupController)
				}
			}

			startupController.SetBlockNumber(data.ToBlock)
		}
	}
}

func (a *Agent) onAgentRegisteredEvent(ev *indexer.Event, startupController *agentEventStartupController) {
	agentRegisteredEvent, ok := ev.ToAgentRegisteredEvent()
	if !ok {
		return
	}

	if ev.Raw.FromAddress.Cmp(a.agentRegistryAddress) != 0 {
		slog.Warn("agent registered event is not from agent registry, skipping")
		return
	}

	a.nameCache.EnqueueForValidation(agentRegisteredEvent.Name)
}

func (a *Agent) onTeeUnencumberedEvent(ev *indexer.Event) {
	if ev.Raw.BlockNumber < a.startupBlockNumber {
		return
	}

	teeUnencumberedEvent, ok := ev.ToTeeUnencumberedEvent()
	if !ok {
		slog.Warn("failed to convert event to tee unencumbered event", "event", ev)
		return
	}

	if teeUnencumberedEvent.Tee.Cmp(a.account.Address()) == 0 {
		slog.Info("found valid TeeUnencumbered event, twitter and email are now unencumbered")
		a.isUnencumbered = true
	}
}

func (a *Agent) onPromptConsumedEvent(ev *indexer.Event, startupController *agentEventStartupController) {
	if ev.Raw.BlockNumber == 0 || ev.Raw.BlockNumber > a.startupBlockNumber {
		return
	}

	promptConsumedEvent, ok := ev.ToPromptConsumedEvent()
	if !ok {
		slog.Warn("failed to convert event to prompt consumed event", "event", ev)
		return
	}

	slog.Info("noticed prompt was already consumed", "agent_address", ev.Raw.FromAddress, "prompt_id", promptConsumedEvent.PromptID)

	startupController.ClearStartupTask(ev.Raw.FromAddress.Bytes(), promptConsumedEvent.PromptID)
}

func (a *Agent) onPromptPaidEvent(ctx context.Context, ev *indexer.Event, startupController *agentEventStartupController) {
	promptPaidEvent, ok := ev.ToPromptPaidEvent()
	if !ok {
		slog.Warn("failed to convert event to prompt paid event", "event", ev)
		return
	}

	slog.Info("received prompt paid event", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID)

	task := func() {
		slog.Info("processing prompt paid event",
			"agent_address", ev.Raw.FromAddress,
			"tweet_id", promptPaidEvent.TweetID,
			"prompt_id", promptPaidEvent.PromptID)

		agentInfo, err := a.agentIndexer.GetOrFetchAgentInfo(ctx, ev.Raw.FromAddress, ev.Raw.BlockNumber)
		if err != nil {
			slog.Warn("failed to get agent info", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID, "error", err)
			return
		}

		timeNow := uint64(time.Now().Unix())

		if timeNow >= agentInfo.EndTime {
			slog.Info("agent is expired", "agent_address", ev.Raw.FromAddress, "end_time", agentInfo.EndTime)
			return
		}

		isPromptConsumed, err := a.isPromptConsumed(ctx, ev.Raw.FromAddress, promptPaidEvent.PromptID)
		if err != nil {
			slog.Warn("failed to check if prompt is consumed", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID, "error", err)
			return
		}

		if isPromptConsumed {
			slog.Info("prompt already consumed", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID)
			return
		}

		err = a.ProcessPromptPaidEvent(ctx, ev.Raw.FromAddress, promptPaidEvent, ev.Raw.BlockNumber)
		if err != nil {
			slog.Warn("failed to process prompt paid event", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID, "error", err)
		}
	}

	if startupController.IsStartupPhase() {
		slog.Info("adding startup task", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID)
		startupController.AddStartupTask(ev.Raw.FromAddress.Bytes(), promptPaidEvent.PromptID, task)
	} else {
		err := a.pool.Go(task)
		if err != nil {
			slog.Error("failed to pool startup task", "agent_address", ev.Raw.FromAddress, "prompt_id", promptPaidEvent.PromptID, "error", err)
		}
	}
}

func (a *Agent) ProcessPromptPaidEvent(ctx context.Context, agentAddress *felt.Felt, promptPaidEvent *indexer.PromptPaidEvent, block uint64) error {
	agentInfo, err := a.agentIndexer.GetOrFetchAgentInfo(ctx, agentAddress, block)
	if err != nil {
		return fmt.Errorf("failed to get agent info: %v", err)
	}

	return a.reactToTweet(ctx, &agentInfo, promptPaidEvent)
}

func (a *Agent) reactToTweet(ctx context.Context, agentInfo *indexer.AgentInfo, promptPaidEvent *indexer.PromptPaidEvent) error {
	slog.Info("generating AI response", "tweet_id", promptPaidEvent.TweetID)

	expectedTweet := fmt.Sprintf("@%s :%s: %s", a.twitterClientConfig.Username, agentInfo.Name, promptPaidEvent.Prompt)
	if len(expectedTweet) > 280 {
		return fmt.Errorf("prompt is too long, expected %d tokens, got %d", 280, len(expectedTweet))
	}

	metadata := a.buildChatMetadata(agentInfo, promptPaidEvent)
	resp, err := a.chatCompletion.Prompt(ctx, metadata, agentInfo.SystemPrompt, promptPaidEvent.Prompt)
	if err != nil {
		return fmt.Errorf("failed to generate AI response: %v", err)
	}

	isDrain := resp.Drain != nil
	drainTo := agentInfo.Address
	errorReply := ""

	drainTarget := ""
	if isDrain {
		drainTarget = resp.Drain.Address
	}
	slog.Info("reacting to tweet", "agent_address", agentInfo.Address, "tweet_id", promptPaidEvent.TweetID, "prompt_id", promptPaidEvent.PromptID, "prompt", promptPaidEvent.Prompt, "is_drain", isDrain, "drain_target", drainTarget)

	if isDrain {
		respAddress, err := starknetgoutils.HexToFelt(resp.Drain.Address)
		if err != nil {
			slog.Warn("failed to convert address to felt", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "error", err)

			isDrain = false
			errorReply = "Seems like the drain address is invalid. Please try again."
		} else {
			drainTo = respAddress
		}
	}

	txHash := new(felt.Felt)
	if !debug.IsDebugDisableConsumption() {
		var err error
		txHash, err = a.consumePrompt(ctx, agentInfo.Address, promptPaidEvent.PromptID, drainTo)
		if err != nil {
			slog.Warn("failed to consume prompt", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "error", snaccount.FormatRpcError(err))
			return fmt.Errorf("failed to consume prompt: %v", err)
		}
	}

	if !debug.IsDebugDisableReplies() {
		slog.Info("fetching tweet text", "tweet_id", promptPaidEvent.TweetID)
		tweetText, err := a.twitterClient.GetTweetText(promptPaidEvent.TweetID)
		if err != nil {
			slog.Warn("failed to get tweet text", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "error", err)
			return nil
		}

		err = a.validateTweetText(tweetText, agentInfo.Name, promptPaidEvent.Prompt)
		if err != nil {
			slog.Warn("tweet text validation failed", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "error", err)
			if !debug.IsDebugDisableTweetValidation() {
				return nil
			}
		}

		tweetAgentIdentifier := agentInfo.Name

		nameValidCtx, _ := context.WithTimeout(ctx, 30*time.Second)
		isNameValid, err := a.nameCache.IsValidWithWait(nameValidCtx, agentInfo.Name)
		if err != nil {
			slog.Error("error while checking name validity", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "name", agentInfo.Name, "error", err)
			isNameValid = false
		}
		if !isNameValid {
			slog.Warn("agent name is not valid", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "name", agentInfo.Name)
			tweetAgentIdentifier = agentInfo.Address.String()
		}

		if isDrain {
			slog.Info("sending tweet", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "drain_to", resp.Drain.Address)
			tweet := fmt.Sprintf(":%s: was drained! Check it out on https://sepolia.voyager.online/tx/%s. Congratulations!", tweetAgentIdentifier, txHash)
			err := a.twitterClient.SendTweet(tweet)
			if err != nil {
				slog.Warn("failed to send tweet", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "error", err)
			}

			slog.Info("replying as drained to", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "drain_to", resp.Drain.Address)
			reply := fmt.Sprintf(":%s: Drained! Check it out on https://sepolia.voyager.online/tx/%s. Congratulations!", tweetAgentIdentifier, txHash)
			err = a.twitterClient.ReplyToTweet(promptPaidEvent.TweetID, reply)
			if err != nil {
				slog.Warn("failed to reply to tweet", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "error", err)
			}
		}

		var reply string
		if len(errorReply) > 0 {
			reply = errorReply
		} else {
			reply = resp.Response
		}

		if strings.TrimSpace(reply) != "" {
			slog.Info("replying to", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "reply", reply)
			err = a.twitterClient.ReplyToTweet(promptPaidEvent.TweetID, fmt.Sprintf(":%s: %s", tweetAgentIdentifier, reply))
			if err != nil {
				slog.Warn("failed to reply to tweet", "agent_address", agentInfo.Address, "prompt_id", promptPaidEvent.PromptID, "tweet_id", promptPaidEvent.TweetID, "error", err)
			}
		}
	}

	return nil
}

func (a *Agent) consumePrompt(ctx context.Context, agentAddress *felt.Felt, promptID uint64, drainTo *felt.Felt) (*felt.Felt, error) {
	fnCall := rpc.FunctionCall{
		ContractAddress:    a.agentRegistryAddress,
		EntryPointSelector: consumePromptSelector,
		Calldata:           []*felt.Felt{agentAddress, new(felt.Felt).SetUint64(promptID), drainTo},
	}

	ch, err := a.txQueue.Enqueue(ctx, []rpc.FunctionCall{fnCall})
	if err != nil {
		return nil, fmt.Errorf("failed to enqueue transaction: %v", err)
	}

	txHash, err := snaccount.WaitForResult(ctx, ch)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for transaction result: %v", err)
	}

	slog.Info("transaction broadcast successful", "tx_hash", txHash)

	return txHash, nil
}

type QuoteData struct {
	Quote      string
	ReportData *quote.ReportData
}

func (a *Agent) quote(ctx context.Context) (*QuoteData, error) {
	slog.Info("requesting quote")

	reportData := &quote.ReportData{
		Address:         a.account.Address(),
		ContractAddress: a.agentRegistryAddress,
		TwitterUsername: a.twitterClientConfig.Username,
	}

	quote, err := a.quoter.Quote(ctx, reportData)
	if err != nil {
		return nil, fmt.Errorf("failed to get quote: %v", err)
	}

	slog.Info("quote generated successfully")

	return &QuoteData{
		Quote:      quote,
		ReportData: reportData,
	}, nil
}

func (a *Agent) validateTweetText(tweetText, agentName, promptText string) error {
	// Check if the tweet contains the username
	if !strings.Contains(tweetText, "@"+a.twitterClientConfig.Username) {
		return fmt.Errorf("tweet must mention @%s", a.twitterClientConfig.Username)
	}

	// Check if the tweet contains the agent name with colon format
	agentNamePattern := ":" + agentName + ":"
	if !strings.Contains(tweetText, agentNamePattern) {
		return fmt.Errorf("tweet must include agent name in format :%s:", agentName)
	}

	return nil
}

func (a *Agent) isPromptConsumed(ctx context.Context, agentAddress *felt.Felt, promptID uint64) (bool, error) {
	fnCall := rpc.FunctionCall{
		ContractAddress:    agentAddress,
		EntryPointSelector: starknetgoutils.GetSelectorFromNameFelt("get_pending_prompt_submitter"),
		Calldata:           []*felt.Felt{new(felt.Felt).SetUint64(promptID)},
	}

	var resp []*felt.Felt
	var err error

	if err := a.starknetClient.Do(func(provider rpc.RpcProvider) error {
		resp, err = provider.Call(ctx, fnCall, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return false, fmt.Errorf("failed to call get_pending_prompt: %w", snaccount.FormatRpcError(err))
	}

	if len(resp) < 1 {
		return false, fmt.Errorf("invalid response length: got %d, want at least 1", len(resp))
	}

	// Check if submitter is zero address (indicating consumed)
	return resp[0].IsZero(), nil
}

func (a *Agent) checkAccountBalance(ctx context.Context) (*big.Int, error) {
	fnCall := rpc.FunctionCall{
		ContractAddress:    ethAddress,
		EntryPointSelector: balanceOfSelector,
		Calldata:           []*felt.Felt{a.account.Address()},
	}

	var resp []*felt.Felt
	var err error

	if err := a.starknetClient.Do(func(provider rpc.RpcProvider) error {
		resp, err = provider.Call(ctx, fnCall, rpc.WithBlockTag("pending"))
		return err
	}); err != nil {
		return nil, fmt.Errorf("failed to call balance_of: %w", snaccount.FormatRpcError(err))
	}

	if len(resp) < 2 {
		return nil, fmt.Errorf("invalid response length: got %d, want at least 2", len(resp))
	}

	balance := snaccount.Uint256ToBigInt([2]*felt.Felt(resp[0:2]))

	return balance, nil
}

func (a *Agent) waitForAccountDeployment(ctx context.Context) error {
	isDeployed, err := a.account.LoadDeployment(ctx, a.starknetClient)
	if err != nil {
		return fmt.Errorf("failed to load deployment state: %w", err)
	}

	if isDeployed {
		slog.Info("account already deployed, not waiting for deployment")
		a.accountDeploymentState.AlreadyDeployed = true

		return nil
	}

	for {
		for {
			slog.Info("checking account balance")

			balance, err := a.checkAccountBalance(ctx)
			if err != nil {
				return fmt.Errorf("account balance is 0: %w", err)
			}

			a.accountDeploymentState.Balance = balance
			a.accountDeploymentState.BalanceUpdatedAt = time.Now().Unix()

			if balance.Cmp(big.NewInt(0)) != 0 {
				break
			}

			slog.Info("account balance is 0, waiting for 5 seconds")

			time.Sleep(5 * time.Second)
		}

		slog.Info("deploying account")

		err := a.account.Deploy(context.Background(), a.starknetClient)
		if err != nil {
			slog.Error("failed to deploy account", "error", err)
			a.accountDeploymentState.DeploymentErr = err
		} else {
			a.accountDeploymentState.DeployedAt = time.Now().Unix()
			break
		}

		time.Sleep(10 * time.Second)
	}

	a.accountDeploymentState.Waiting = true
	time.Sleep(2 * time.Minute)
	a.accountDeploymentState.Waiting = false

	return nil
}

func (a *Agent) buildChatMetadata(agentInfo *indexer.AgentInfo, promptPaidEvent *indexer.PromptPaidEvent) string {
	return fmt.Sprintf(`
Your address: %s
Your creator address: %s
Responding to address: %s

You can either respond to the user or use the drain tool.
Don't expect the user to reply to your message.
Your response must be at most 280 characters long.
Your response must be humanly readable.
`,
		agentInfo.Address.String(),
		agentInfo.Creator.String(),
		promptPaidEvent.User.String(),
	)
}
