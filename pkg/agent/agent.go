package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/alitto/pond/v2"
	"github.com/dghubble/oauth1"
	"github.com/sashabaranov/go-openai"
	"github.com/tmc/langchaingo/jsonschema"

	snaccount "github.com/NethermindEth/teeception/pkg/utils/wallet/starknet"
)

var (
	promptPaidSelector      = starknetgoutils.GetSelectorFromNameFelt("PromptPaid")
	getSystemPromptSelector = starknetgoutils.GetSelectorFromNameFelt("get_system_prompt")
	transferSelector        = starknetgoutils.GetSelectorFromNameFelt("transfer")
)

type AgentConfig struct {
	TwitterUsername          string
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
}

type Agent struct {
	config *AgentConfig

	twitterClient     *http.Client
	openaiClient      *openai.Client
	starknetClient    *rpc.Provider
	dStackTappdClient *tappd.TappdClient

	lastBlockNumber uint64

	account *snaccount.StarknetAccount

	pool pond.Pool
}

func NewAgent(config *AgentConfig) (*Agent, error) {
	slog.Info("initializing new agent", "twitter_username", config.TwitterUsername)

	twitterClient := oauth1.NewConfig(config.TwitterConsumerKey, config.TwitterConsumerSecret).
		Client(oauth1.NoContext, oauth1.NewToken(config.TwitterAccessToken, config.TwitterAccessTokenSecret))

	openaiClient := openai.NewClient(config.OpenAIKey)

	dstackTappdClient := tappd.NewTappdClient(config.DstackTappdEndpoint, slog.Default())

	slog.Info("connecting to starknet", "rpc_url", config.StarknetRpcUrl)
	starknetClient, err := rpc.NewProvider(config.StarknetRpcUrl)
	if err != nil {
		return nil, err
	}

	privateKey := snaccount.NewPrivateKey(config.StarknetPrivateKeySeed)
	account, err := snaccount.NewStarknetAccount(privateKey)
	if err != nil {
		return nil, err
	}
	err = account.Connect(starknetClient)
	if err != nil {
		return nil, err
	}

	slog.Info("agent initialized successfully", "account_address", account.Address())

	return &Agent{
		config: config,

		twitterClient:     twitterClient,
		openaiClient:      openaiClient,
		starknetClient:    starknetClient,
		dStackTappdClient: dstackTappdClient,

		lastBlockNumber: 0,

		account: account,
		pool:    pond.NewPool(config.TaskConcurrency),
	}, nil
}

func (a *Agent) Run(ctx context.Context) error {
	slog.Info("starting agent")

	blockNumber, err := a.starknetClient.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get latest block number: %v", err)
	}

	a.lastBlockNumber = blockNumber
	slog.Info("initialized last block number", "block_number", blockNumber)

	if err := a.StartServer(ctx); err != nil {
		return fmt.Errorf("failed to start server: %v", err)
	}

	slog.Info("entering main loop")
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(a.config.TickRate):
			a.Tick(ctx)
		}
	}
}

func (a *Agent) Tick(ctx context.Context) error {
	blockNumber, err := a.starknetClient.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get latest block number: %v", err)
	}

	blockNumber = blockNumber - a.config.SafeBlockDelta

	if blockNumber <= a.lastBlockNumber {
		return nil
	}

	slog.Info("processing new blocks", "from_block", a.lastBlockNumber, "to_block", blockNumber)

	eventChunk, err := a.starknetClient.Events(ctx, rpc.EventsInput{
		EventFilter: rpc.EventFilter{
			FromBlock: rpc.BlockID{Number: &a.lastBlockNumber},
			ToBlock:   rpc.BlockID{Number: &blockNumber},
			Keys: [][]*felt.Felt{
				{promptPaidSelector},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to get block receipts: %v", err)
	}

	slog.Info("found events", "count", len(eventChunk.Events))

	for _, event := range eventChunk.Events {
		err := a.pool.Go(func() {
			promptPaidEvent, success, err := a.parseEvent(ctx, event)
			if err != nil {
				slog.Warn("failed to parse event", "error", err)
				return
			}
			if !success {
				return
			}

			slog.Info("processing prompt paid event",
				"agent_address", promptPaidEvent.AgentAddress,
				"from_address", promptPaidEvent.FromAddress,
				"tweet_id", promptPaidEvent.TweetID)

			err = a.processPromptPaidEvent(ctx, promptPaidEvent)
			if err != nil {
				slog.Warn("failed to process prompt paid event", "error", err)
			}
		})
		if err != nil {
			slog.Warn("failed to submit task to pool", "error", err)
		}
	}

	a.lastBlockNumber = blockNumber

	return nil
}

type PromptPaidEvent struct {
	AgentAddress *felt.Felt
	FromAddress  *felt.Felt
	TweetID      uint64
}

func (a *Agent) parseEvent(ctx context.Context, event rpc.EmittedEvent) (*PromptPaidEvent, bool, error) {
	if event.Keys[0] != promptPaidSelector {
		return nil, false, nil
	}

	agentAddress := event.FromAddress
	fromAddress := event.Keys[1]
	tweetID := event.Keys[2].Uint64()

	if event.Keys[2].Cmp(new(felt.Felt).SetUint64(tweetID)) != 0 {
		return nil, false, fmt.Errorf("twitter message ID overflow")
	}

	promptPaidEvent := &PromptPaidEvent{
		FromAddress:  fromAddress,
		AgentAddress: agentAddress,
		TweetID:      tweetID,
	}

	return promptPaidEvent, true, nil
}

func (a *Agent) processPromptPaidEvent(ctx context.Context, promptPaidEvent *PromptPaidEvent) error {
	slog.Info("fetching tweet text", "tweet_id", promptPaidEvent.TweetID)
	tweetText, err := a.getTweetText(promptPaidEvent.TweetID)
	if err != nil {
		return fmt.Errorf("failed to get tweet text: %v", err)
	}

	slog.Info("fetching system prompt", "agent_address", promptPaidEvent.AgentAddress)
	systemPrompt, err := a.getSystemPrompt(promptPaidEvent.AgentAddress)
	if err != nil {
		return fmt.Errorf("failed to get system prompt: %v", err)
	}

	return a.reactToTweet(ctx, promptPaidEvent.AgentAddress, promptPaidEvent.TweetID, tweetText, systemPrompt)
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
	a.replyToTweet(tweetID, resp.Choices[0].Message.Content)

	for _, toolCall := range resp.Choices[0].Message.ToolCalls {
		if toolCall.Function.Name == "drain" {
			type drainArgs struct {
				Address string `json:"address"`
			}

			var args drainArgs
			json.Unmarshal([]byte(toolCall.Function.Arguments), &args)

			slog.Info("draining tokens", "from", agentAddress, "to", args.Address)
			txHash, err := a.drain(ctx, agentAddress, args.Address)
			if err != nil {
				a.replyToTweet(tweetID, fmt.Sprintf("Almost drained %s to %s!", agentAddress, args.Address))
				return fmt.Errorf("failed to drain: %v", err)
			}

			slog.Info("drain successful", "tx_hash", txHash)
			a.replyToTweet(tweetID, fmt.Sprintf("Drained %s to %s: %s. Congratulations!", agentAddress, args.Address, txHash))
		}
	}

	return nil
}

func (a *Agent) drain(ctx context.Context, agentAddress *felt.Felt, addressStr string) (*felt.Felt, error) {
	slog.Info("initiating drain transaction")

	acc, err := a.account.Account()
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %v", err)
	}

	nonce, err := acc.Nonce(ctx, rpc.WithBlockTag("latest"), a.account.Address())
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %v", err)
	}

	addressFelt, err := starknetgoutils.HexToFelt(addressStr)
	if err != nil {
		return nil, fmt.Errorf("failed to convert address to felt: %v", err)
	}

	invokeTxn := rpc.BroadcastInvokev1Txn{
		InvokeTxnV1: rpc.InvokeTxnV1{
			MaxFee:        new(felt.Felt).SetUint64(100000000000000),
			Version:       rpc.TransactionV1,
			Nonce:         nonce,
			Type:          rpc.TransactionType_Invoke,
			SenderAddress: a.account.Address(),
		}}
	fnCall := rpc.FunctionCall{
		ContractAddress:    a.config.AgentRegistryAddress,
		EntryPointSelector: transferSelector,
		Calldata:           []*felt.Felt{agentAddress, addressFelt},
	}
	invokeTxn.Calldata, err = acc.FmtCalldata([]rpc.FunctionCall{fnCall})
	if err != nil {
		return nil, fmt.Errorf("failed to format calldata: %v", err)
	}

	slog.Info("estimating transaction fee")
	feeResp, err := acc.EstimateFee(ctx, []rpc.BroadcastTxn{invokeTxn}, []rpc.SimulationFlag{}, rpc.WithBlockTag("latest"))
	if err != nil {
		return nil, fmt.Errorf("failed to estimate fee: %v", err)
	}

	fee := feeResp[0].OverallFee
	invokeTxn.MaxFee = fee.Add(fee, fee.Div(fee, new(felt.Felt).SetUint64(5)))

	slog.Info("signing transaction")
	err = acc.SignInvokeTransaction(ctx, &invokeTxn.InvokeTxnV1)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %v", err)
	}

	slog.Info("broadcasting transaction")
	resp, err := acc.AddInvokeTransaction(ctx, invokeTxn)
	if err != nil {
		return nil, fmt.Errorf("failed to add transaction: %v", err)
	}

	slog.Info("transaction broadcast successful", "tx_hash", resp.TransactionHash)
	return resp.TransactionHash, nil
}

func (a *Agent) getSystemPrompt(agentAddress *felt.Felt) (string, error) {
	tx := rpc.FunctionCall{
		ContractAddress:    agentAddress,
		EntryPointSelector: getSystemPromptSelector,
	}

	systemPromptByteArrFelt, err := a.starknetClient.Call(context.Background(), tx, rpc.BlockID{Tag: "latest"})
	if err != nil {
		return "", fmt.Errorf("failed to get system prompt: %v", err)
	}

	return starknetgoutils.ByteArrFeltToString(systemPromptByteArrFelt)
}

func (a *Agent) replyToTweet(tweetID uint64, reply string) error {
	resp, err := a.twitterClient.Post(fmt.Sprintf("https://api.twitter.com/2/tweets/%d/reply", tweetID), "application/json", strings.NewReader(reply))
	if err != nil {
		return fmt.Errorf("failed to reply to tweet: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to reply to tweet: %v", resp.Status)
	}

	return nil
}

func (a *Agent) getTweetText(tweetID uint64) (string, error) {
	resp, err := a.twitterClient.Get(fmt.Sprintf("https://api.x.com/2/tweets/%d?tweet.fields=text", tweetID))
	if err != nil {
		return "", fmt.Errorf("failed to get tweet by id: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get tweet by id: %v", resp.Status)
	}

	type tweet struct {
		Data struct {
			Text string `json:"text"`
		} `json:"data"`
	}

	var data tweet
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return "", fmt.Errorf("failed to decode tweet: %v", err)
	}

	return data.Data.Text, nil
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
