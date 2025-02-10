package service

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/teeception/pkg/indexer"
	"github.com/NethermindEth/teeception/pkg/indexer/price"
	"github.com/NethermindEth/teeception/pkg/wallet/starknet"
	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
)

type UIServiceConfig struct {
	Client               starknet.ProviderWrapper
	MaxPageSize          int
	ServerAddr           string
	RegistryAddress      *felt.Felt
	StartingBlock        uint64
	TokenRates           map[[32]byte]*big.Int
	BalanceTickRate      time.Duration
	PriceTickRate        time.Duration
	EventTickRate        time.Duration
	EventStartupTickRate time.Duration
}

type UIService struct {
	eventWatcher        *indexer.EventWatcher
	agentIndexer        *indexer.AgentIndexer
	agentBalanceIndexer *indexer.AgentBalanceIndexer
	agentUsageIndexer   *indexer.AgentUsageIndexer
	tokenIndexer        *indexer.TokenIndexer

	registryAddress *felt.Felt

	client starknet.ProviderWrapper

	maxPageSize int
	serverAddr  string
}

func NewUIService(config *UIServiceConfig) (*UIService, error) {
	lastIndexedBlock := config.StartingBlock - 1

	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          config.Client,
		SafeBlockDelta:  0,
		TickRate:        config.EventTickRate,
		StartupTickRate: config.EventStartupTickRate,
		IndexChunkSize:  1000,
		RegistryAddress: config.RegistryAddress,
		InitialState: &indexer.EventWatcherInitialState{
			LastIndexedBlock: lastIndexedBlock,
		},
	})
	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.AgentIndexerInitialState{
			Db: indexer.NewAgentIndexerDatabaseInMemory(lastIndexedBlock),
		},
	})
	priceFeed := price.NewStaticPriceFeed(config.TokenRates)
	tokenIndexer := indexer.NewTokenIndexer(&indexer.TokenIndexerConfig{
		PriceFeed:       priceFeed,
		PriceTickRate:   config.PriceTickRate,
		RegistryAddress: config.RegistryAddress,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.TokenIndexerInitialState{
			Db: indexer.NewTokenIndexerDatabaseInMemory(lastIndexedBlock),
		},
	})
	agentBalanceIndexer := indexer.NewAgentBalanceIndexer(&indexer.AgentBalanceIndexerConfig{
		Client:          config.Client,
		AgentIdx:        agentIndexer,
		TickRate:        config.BalanceTickRate,
		SafeBlockDelta:  0,
		RegistryAddress: config.RegistryAddress,
		PriceCache:      tokenIndexer,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.AgentBalanceIndexerInitialState{
			Db: indexer.NewAgentBalanceIndexerDatabaseInMemory(lastIndexedBlock),
		},
	})
	agentUsageIndexer := indexer.NewAgentUsageIndexer(&indexer.AgentUsageIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		MaxPrompts:      10,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.AgentUsageIndexerInitialState{
			Db: indexer.NewAgentUsageIndexerDatabaseInMemory(lastIndexedBlock, 10),
		},
	})

	return &UIService{
		eventWatcher:        eventWatcher,
		agentIndexer:        agentIndexer,
		agentBalanceIndexer: agentBalanceIndexer,
		agentUsageIndexer:   agentUsageIndexer,
		tokenIndexer:        tokenIndexer,

		registryAddress: config.RegistryAddress,

		client:      config.Client,
		maxPageSize: config.MaxPageSize,
		serverAddr:  config.ServerAddr,
	}, nil
}

func (s *UIService) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return s.eventWatcher.Run(ctx)
	})
	g.Go(func() error {
		return s.agentIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.agentBalanceIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.agentUsageIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.tokenIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.startServer(ctx)
	})
	return g.Wait()
}

func (s *UIService) startServer(ctx context.Context) error {
	router := gin.Default()

	router.GET("/leaderboard", s.HandleGetLeaderboard)
	router.GET("/agent/:address", s.HandleGetAgent)
	router.GET("/user/agents", s.HandleGetUserAgents)
	router.GET("/search", s.HandleSearchAgents)

	server := &http.Server{
		Addr:    s.serverAddr,
		Handler: router,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
		}
	}()

	<-ctx.Done()
	if err := server.Shutdown(context.Background()); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	return nil
}

type AgentData struct {
	Pending       bool                     `json:"pending"`
	Address       string                   `json:"address"`
	Creator       string                   `json:"creator"`
	Token         string                   `json:"token"`
	Name          string                   `json:"name"`
	SystemPrompt  string                   `json:"system_prompt"`
	Balance       string                   `json:"balance"`
	EndTime       string                   `json:"end_time"`
	IsDrained     bool                     `json:"is_drained"`
	IsFinalized   bool                     `json:"is_finalized"`
	PromptPrice   string                   `json:"prompt_price"`
	BreakAttempts string                   `json:"break_attempts"`
	LatestPrompts []*AgentDataLatestPrompt `json:"latest_prompts"`
}

type AgentDataLatestPrompt struct {
	PromptID  string `json:"prompt_id"`
	TweetID   string `json:"tweet_id"`
	Prompt    string `json:"prompt"`
	IsSuccess bool   `json:"is_success"`
	DrainedTo string `json:"drained_to"`
}

type AgentPageResponse struct {
	Agents    []*AgentData `json:"agents"`
	Total     int          `json:"total"`
	Page      int          `json:"page"`
	PageSize  int          `json:"page_size"`
	LastBlock int          `json:"last_block"`
}

func (s *UIService) getPageSize(requestedSize int) int {
	if requestedSize <= 0 {
		return s.maxPageSize
	}
	if requestedSize > s.maxPageSize {
		return s.maxPageSize
	}
	return requestedSize
}

func (s *UIService) HandleGetLeaderboard(c *gin.Context) {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil {
		page = 0
	}

	pageSize := s.getPageSize(0)
	if sizeStr := c.Query("page_size"); sizeStr != "" {
		if size, err := strconv.Atoi(sizeStr); err == nil {
			pageSize = s.getPageSize(size)
		}
	}

	agents, err := s.agentBalanceIndexer.GetAgentLeaderboard(uint64(page)*uint64(pageSize), uint64(page+1)*uint64(pageSize))
	if err != nil {
		slog.Error("error fetching agent leaderboard", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error fetching agent leaderboard"})
		return
	}

	agentDatas := make([]*AgentData, 0, len(agents.Agents))
	agentAddr := new(felt.Felt)
	for _, agentBytes := range agents.Agents {
		agentAddr.SetBytes(agentBytes[:])

		info, ok := s.agentIndexer.GetAgentInfo(agentAddr)
		if !ok {
			slog.Error("failed to get agent info", "error", err)
			continue
		}

		agentData, err := s.buildAgentData(&info)
		if err != nil {
			slog.Error("failed to build agent data", "error", err)
			continue
		}

		agentDatas = append(agentDatas, agentData)
	}

	c.JSON(http.StatusOK, &AgentPageResponse{
		Agents:    agentDatas,
		Total:     int(agents.AgentCount),
		Page:      page,
		PageSize:  pageSize,
		LastBlock: int(agents.LastBlock),
	})
}

func (s *UIService) HandleGetAgent(c *gin.Context) {
	agentAddrStr := c.Param("address")
	agentAddr, err := new(felt.Felt).SetString(agentAddrStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("invalid agent address: %w", err).Error()})
		return
	}

	info, ok := s.agentIndexer.GetAgentInfo(agentAddr)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found in agent indexer"})
		return
	}

	agentData, err := s.buildAgentData(&info)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build agent data"})
		return
	}

	c.JSON(http.StatusOK, agentData)
}

func (s *UIService) HandleGetUserAgents(c *gin.Context) {
	userAddrStr := c.Query("user")
	if userAddrStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user address required"})
		return
	}

	userAddr, err := new(felt.Felt).SetString(userAddrStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("invalid user address: %w", err).Error()})
		return
	}

	page, err := strconv.Atoi(c.Query("page"))
	if err != nil {
		page = 0
	}

	pageSize := s.getPageSize(0)
	if sizeStr := c.Query("page_size"); sizeStr != "" {
		if size, err := strconv.Atoi(sizeStr); err == nil {
			pageSize = s.getPageSize(size)
		}
	}

	start := uint64(page) * uint64(pageSize)
	limit := uint64(pageSize)

	agents, ok := s.agentIndexer.GetAgentsByCreator(c.Request.Context(), userAddr, start, limit)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "no agents found for user"})
		return
	}

	agentDatas := make([]*AgentData, 0, len(agents.Agents))
	for _, info := range agents.Agents {
		agentData, err := s.buildAgentData(&info)
		if err != nil {
			slog.Error("failed to build agent data", "error", err)
			continue
		}
		agentDatas = append(agentDatas, agentData)
	}

	c.JSON(http.StatusOK, &AgentPageResponse{
		Agents:    agentDatas,
		Total:     int(agents.AgentCount),
		Page:      page,
		PageSize:  pageSize,
		LastBlock: int(agents.LastBlock),
	})
}

func (s *UIService) HandleSearchAgents(c *gin.Context) {
	name := c.Query("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}

	page, err := strconv.Atoi(c.Query("page"))
	if err != nil {
		page = 0
	}

	pageSize := s.getPageSize(0)
	if sizeStr := c.Query("page_size"); sizeStr != "" {
		if size, err := strconv.Atoi(sizeStr); err == nil {
			pageSize = s.getPageSize(size)
		}
	}

	start := uint64(page) * uint64(pageSize)
	limit := uint64(pageSize)

	agents, ok := s.agentIndexer.GetAgentInfosByNamePrefix(name, start, limit)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "no agents found for name"})
		return
	}

	agentDatas := make([]*AgentData, 0, len(agents.AgentInfos))
	for _, info := range agents.AgentInfos {
		agentData, err := s.buildAgentData(info)
		if err != nil {
			slog.Error("failed to build agent data", "error", err)
			continue
		}
		agentDatas = append(agentDatas, agentData)
	}

	c.JSON(http.StatusOK, &AgentPageResponse{
		Agents:    agentDatas,
		Total:     int(agents.Total),
		Page:      page,
		PageSize:  pageSize,
		LastBlock: int(agents.LastBlock),
	})
}

func (s *UIService) buildAgentData(info *indexer.AgentInfo) (*AgentData, error) {
	balance, ok := s.agentBalanceIndexer.GetBalance(info.Address)
	if !ok {
		return nil, fmt.Errorf("failed to get agent balance for %s", info.Address)
	}

	if balance.Token == nil || balance.Amount == nil {
		return nil, fmt.Errorf("invalid balance data for agent %s", info.Address)
	}

	usage, ok := s.agentUsageIndexer.GetAgentUsage(info.Address)
	if !ok {
		return nil, fmt.Errorf("failed to get agent usage for %s", info.Address)
	}

	latestPrompts := make([]*AgentDataLatestPrompt, 0, len(usage.LatestPrompts))
	for _, prompt := range usage.LatestPrompts {
		latestPrompts = append(latestPrompts, &AgentDataLatestPrompt{
			PromptID:  strconv.FormatUint(prompt.PromptID, 10),
			TweetID:   strconv.FormatUint(prompt.TweetID, 10),
			Prompt:    prompt.Prompt,
			IsSuccess: prompt.IsSuccess,
			DrainedTo: prompt.DrainedTo.String(),
		})
	}

	return &AgentData{
		Pending:       balance.Pending,
		Address:       info.Address.String(),
		Creator:       info.Creator.String(),
		Name:          info.Name,
		SystemPrompt:  info.SystemPrompt,
		Token:         balance.Token.String(),
		Balance:       balance.Amount.String(),
		EndTime:       strconv.FormatUint(balance.EndTime, 10),
		IsDrained:     usage.IsDrained,
		IsFinalized:   time.Now().After(time.Unix(int64(balance.EndTime), 0)) || usage.IsDrained,
		PromptPrice:   info.PromptPrice.String(),
		BreakAttempts: strconv.FormatUint(usage.BreakAttempts, 10),
		LatestPrompts: latestPrompts,
	}, nil
}
