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
	"github.com/NethermindEth/starknet.go/account"
	"github.com/NethermindEth/starknet.go/rpc"
	starknetgoutils "github.com/NethermindEth/starknet.go/utils"
	"github.com/alitto/pond/v2"
	"github.com/dghubble/oauth1"
	"github.com/sashabaranov/go-openai"
	"github.com/tmc/langchaingo/jsonschema"

	snaccount "github.com/NethermindEth/teeception/pkg/utils/wallet/starknet"
)

var (
	depositSelector         = starknetgoutils.GetSelectorFromNameFelt("Deposit")
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

	account *account.Account

	pool pond.Pool
}

func NewAgent(config *AgentConfig) (*Agent, error) {
	twitterClient := oauth1.NewConfig(config.TwitterConsumerKey, config.TwitterConsumerSecret).
		Client(oauth1.NoContext, oauth1.NewToken(config.TwitterAccessToken, config.TwitterAccessTokenSecret))

	openaiClient := openai.NewClient(config.OpenAIKey)

	dstackTappdClient := tappd.NewTappdClient(config.DstackTappdEndpoint, slog.Default())

	starknetClient, err := rpc.NewProvider(config.StarknetRpcUrl)
	if err != nil {
		return nil, err
	}

	privateKey := snaccount.NewPrivateKey(config.StarknetPrivateKeySeed)
	account, err := snaccount.NewStarknetAccount(privateKey)
	if err != nil {
		return nil, err
	}
	connectedAccount, err := account.Connect(starknetClient)
	if err != nil {
		return nil, err
	}

	return &Agent{
		config: config,

		twitterClient:     twitterClient,
		openaiClient:      openaiClient,
		starknetClient:    starknetClient,
		dStackTappdClient: dstackTappdClient,

		lastBlockNumber: 0,

		account: connectedAccount,
		pool:    pond.NewPool(config.TaskConcurrency),
	}, nil
}

func (a *Agent) Run(ctx context.Context) error {
	blockNumber, err := a.starknetClient.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get latest block number: %v", err)
	}

	a.lastBlockNumber = blockNumber

	if err := a.StartServer(ctx); err != nil {
		return fmt.Errorf("failed to start server: %v", err)
	}

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

	eventChunk, err := a.starknetClient.Events(ctx, rpc.EventsInput{
		EventFilter: rpc.EventFilter{
			FromBlock: rpc.BlockID{Number: &a.lastBlockNumber},
			ToBlock:   rpc.BlockID{Number: &blockNumber},
			Keys: [][]*felt.Felt{
				{depositSelector},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to get block receipts: %v", err)
	}

	for _, event := range eventChunk.Events {
		a.pool.Go(func() {
			depositEvent, success, err := a.parseEvent(ctx, event)
			if err != nil {
				slog.Warn("failed to parse event", "error", err)
				return
			}
			if !success {
				return
			}

			err = a.processDepositEvent(ctx, depositEvent)
			if err != nil {
				slog.Warn("failed to process deposit event", "error", err)
			}
		})
	}

	return nil
}

type DepositEvent struct {
	FromAddress  *felt.Felt
	AgentAddress *felt.Felt
	TweetID      uint64
}

func (a *Agent) parseEvent(ctx context.Context, event rpc.EmittedEvent) (*DepositEvent, bool, error) {
	if event.Keys[0] != depositSelector {
		return nil, false, nil
	}

	fromAddress := event.Keys[1]
	agentAddress := event.FromAddress
	tweetID := event.Data[0].Uint64()

	if event.Data[0].Cmp(new(felt.Felt).SetUint64(tweetID)) != 0 {
		return nil, false, fmt.Errorf("twitter message ID overflow")
	}

	depositEvent := &DepositEvent{
		FromAddress:  fromAddress,
		AgentAddress: agentAddress,
		TweetID:      tweetID,
	}

	return depositEvent, true, nil
}

func (a *Agent) processDepositEvent(ctx context.Context, depositEvent *DepositEvent) error {
	tweetText, err := a.getTweetText(depositEvent.TweetID)
	if err != nil {
		return fmt.Errorf("failed to get tweet text: %v", err)
	}

	systemPrompt, err := a.getSystemPrompt(depositEvent.AgentAddress)
	if err != nil {
		return fmt.Errorf("failed to get system prompt: %v", err)
	}

	return a.reactToTweet(ctx, depositEvent.AgentAddress, depositEvent.TweetID, tweetText, systemPrompt)
}

func (a *Agent) reactToTweet(ctx context.Context, agentAddress *felt.Felt, tweetID uint64, tweetText string, systemPrompt string) error {
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

	a.replyToTweet(tweetID, resp.Choices[0].Message.Content)

	for _, toolCall := range resp.Choices[0].Message.ToolCalls {
		if toolCall.Function.Name == "drain" {
			type drainArgs struct {
				Address string `json:"address"`
			}

			var args drainArgs
			json.Unmarshal([]byte(toolCall.Function.Arguments), &args)

			txHash, err := a.drain(ctx, agentAddress, args.Address)
			if err != nil {
				a.replyToTweet(tweetID, fmt.Sprintf("Almost drained %s to %s!", agentAddress, args.Address))
				return fmt.Errorf("failed to drain: %v", err)
			}

			a.replyToTweet(tweetID, fmt.Sprintf("Drained %s to %s: %s. Congratulations!", agentAddress, args.Address, txHash))
		}
	}

	return nil
}

func (a *Agent) drain(ctx context.Context, agentAddress *felt.Felt, addressStr string) (*felt.Felt, error) {
	nonce, err := a.account.Nonce(ctx, rpc.BlockID{Tag: "latest"}, a.account.AccountAddress)
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
			SenderAddress: a.account.AccountAddress,
		}}
	fnCall := rpc.FunctionCall{
		ContractAddress:    a.config.AgentRegistryAddress,
		EntryPointSelector: transferSelector,
		Calldata:           []*felt.Felt{agentAddress, addressFelt},
	}
	invokeTxn.Calldata, err = a.account.FmtCalldata([]rpc.FunctionCall{fnCall})
	if err != nil {
		return nil, fmt.Errorf("failed to format calldata: %v", err)
	}

	feeResp, err := a.account.EstimateFee(ctx, []rpc.BroadcastTxn{invokeTxn}, []rpc.SimulationFlag{}, rpc.WithBlockTag("latest"))
	if err != nil {
		return nil, fmt.Errorf("failed to estimate fee: %v", err)
	}

	fee := feeResp[0].OverallFee
	invokeTxn.MaxFee = fee.Add(fee, fee.Div(fee, new(felt.Felt).SetUint64(5)))

	err = a.account.SignInvokeTransaction(ctx, &invokeTxn.InvokeTxnV1)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %v", err)
	}

	resp, err := a.account.AddInvokeTransaction(ctx, invokeTxn)
	if err != nil {
		return nil, fmt.Errorf("failed to add transaction: %v", err)
	}

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
	reportData := ReportData{
		Address:         a.account.AccountAddress,
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

	return quoteResp, nil
}
