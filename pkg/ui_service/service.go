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
	"github.com/gin-contrib/gzip"
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
	PriceTickRate        time.Duration
	EventTickRate        time.Duration
	EventStartupTickRate time.Duration
	UserTickRate         time.Duration
	AgentBalanceTickRate time.Duration
	PromptIndexerDBPath  string
	PromptIndexerApiKey  string
}

type UIService struct {
	eventWatcher        *indexer.EventWatcher
	agentIndexer        *indexer.AgentIndexer
	agentBalanceIndexer *indexer.AgentBalanceIndexer
	agentUsageIndexer   *indexer.AgentUsageIndexer
	userIndexer         *indexer.UserIndexer
	tokenIndexer        *indexer.TokenIndexer
	promptIndexer       *indexer.PromptIndexer

	registryAddress *felt.Felt

	client starknet.ProviderWrapper

	maxPageSize int
	serverAddr  string

	promptIndexerApiKey string
}

func NewUIService(config *UIServiceConfig) (*UIService, error) {
	lastIndexedBlock := config.StartingBlock - 1

	eventWatcher, err := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
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
	if err != nil {
		return nil, fmt.Errorf("failed to create event watcher: %v", err)
	}

	promptDb, err := indexer.NewPromptIndexerDatabaseSQLite(config.PromptIndexerDBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create prompt database: %v", err)
	}

	promptIndexer, err := indexer.NewPromptIndexer(&indexer.PromptIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.PromptIndexerInitialState{
			Db: promptDb,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create prompt indexer: %v", err)
	}

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
		RegistryAddress: config.RegistryAddress,
		PriceCache:      tokenIndexer,
		EventWatcher:    eventWatcher,
		TickRate:        config.AgentBalanceTickRate,
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
	userIndexer := indexer.NewUserIndexer(&indexer.UserIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		TickRate:        config.UserTickRate,
		PriceCache:      tokenIndexer,
		EventWatcher:    eventWatcher,
		InitialState: &indexer.UserIndexerInitialState{
			Db: indexer.NewUserIndexerDatabaseInMemory(lastIndexedBlock),
		},
	})

	return &UIService{
		eventWatcher:        eventWatcher,
		agentIndexer:        agentIndexer,
		agentBalanceIndexer: agentBalanceIndexer,
		agentUsageIndexer:   agentUsageIndexer,
		userIndexer:         userIndexer,
		tokenIndexer:        tokenIndexer,
		promptIndexer:       promptIndexer,

		registryAddress: config.RegistryAddress,

		client:              config.Client,
		maxPageSize:         config.MaxPageSize,
		serverAddr:          config.ServerAddr,
		promptIndexerApiKey: config.PromptIndexerApiKey,
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
		return s.userIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.tokenIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.promptIndexer.Run(ctx)
	})
	g.Go(func() error {
		return s.startServer(ctx)
	})
	return g.Wait()
}

func (s *UIService) startServer(ctx context.Context) error {
	router := gin.Default()

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.GET("/leaderboard", s.HandleGetLeaderboard)
	router.GET("/agent/:address", s.HandleGetAgent)
	router.GET("/user/leaderboard", s.HandleGetUserLeaderboard)
	router.GET("/user/agents", s.HandleGetUserAgents)
	router.GET("/user/prompts", s.HandleGetUserPrompts)
	router.GET("/search", s.HandleSearchAgents)
	router.GET("/usage", s.HandleGetUsage)
	router.GET("/prompt", s.HandleGetPromptResponse)
	router.POST("/prompt", s.HandleRegisterPromptResponse)

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
	Pending       bool               `json:"pending"`
	Address       string             `json:"address"`
	Creator       string             `json:"creator"`
	Token         string             `json:"token"`
	Name          string             `json:"name"`
	SystemPrompt  string             `json:"system_prompt"`
	PromptPrice   string             `json:"prompt_price"`
	Balance       string             `json:"balance"`
	EndTime       string             `json:"end_time"`
	Model         string             `json:"model"`
	IsDrained     bool               `json:"is_drained"`
	DrainAmount   string             `json:"drain_amount"`
	IsFinalized   bool               `json:"is_finalized"`
	IsWithdrawn   bool               `json:"is_withdrawn"`
	BreakAttempts string             `json:"break_attempts"`
	LatestPrompts []*AgentDataPrompt `json:"latest_prompts"`
	DrainPrompt   *AgentDataPrompt   `json:"drain_prompt"`
}

type AgentDataPrompt struct {
	PromptID  string `json:"prompt_id"`
	TweetID   string `json:"tweet_id"`
	Prompt    string `json:"prompt"`
	User      string `json:"user"`
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

type UserData struct {
	Address         string            `json:"address"`
	AccruedBalances map[string]string `json:"accrued_balances"`
	PromptCount     int               `json:"prompt_count"`
	BreakCount      int               `json:"break_count"`
}

type UserPageResponse struct {
	Users     []*UserData `json:"users"`
	Total     int         `json:"total"`
	Page      int         `json:"page"`
	PageSize  int         `json:"page_size"`
	LastBlock int         `json:"last_block"`
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

	var isActive *bool
	activeQueryParam := c.Query("active")
	if activeQueryParam != "" {
		active, err := strconv.ParseBool(activeQueryParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid \"active\" query parameter"})
			return
		}
		isActive = &active
	}

	agents, err := s.agentBalanceIndexer.GetAgentLeaderboard(uint64(page)*uint64(pageSize), uint64(page+1)*uint64(pageSize), isActive)
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

type GetUsageResponse struct {
	RegisteredAgents uint64                     `json:"registered_agents"`
	Attempts         *GetUsageResponseAttempts  `json:"attempts"`
	PrizePools       GetUsageResponsePrizePools `json:"prize_pools"`
}

type GetUsageResponseAttempts struct {
	Total     uint64 `json:"total"`
	Successes uint64 `json:"successes"`
}

type GetUsageResponsePrizePools = map[string]string

func (s *UIService) HandleGetUsage(c *gin.Context) {
	usage := s.agentUsageIndexer.GetTotalUsage()
	balances := s.agentBalanceIndexer.GetTotalAgentBalances()

	prizePools := make(GetUsageResponsePrizePools)
	for token, balance := range balances {
		prizePools[token.String()] = balance.String()
	}

	c.JSON(http.StatusOK, &GetUsageResponse{
		RegisteredAgents: usage.TotalRegisteredAgents,
		Attempts: &GetUsageResponseAttempts{
			Total:     usage.TotalAttempts,
			Successes: usage.TotalSuccesses,
		},
		PrizePools: prizePools,
	})
}

func (s *UIService) HandleGetUserLeaderboard(c *gin.Context) {
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

	leaderboard, err := s.userIndexer.GetUserLeaderboard(uint64(page)*uint64(pageSize), uint64(page+1)*uint64(pageSize))
	if err != nil {
		slog.Error("error fetching user leaderboard", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user leaderboard"})
		return
	}

	users := make([]*UserData, 0, len(leaderboard.Users))
	for _, userAddr := range leaderboard.Users {
		info, ok := s.userIndexer.GetUserInfo(new(felt.Felt).SetBytes(userAddr[:]))
		if !ok {
			slog.Error("user info not found", "address", userAddr)
			continue
		}

		accruedBalances := make(map[string]string)
		for token, balance := range info.AccruedBalances {
			accruedBalances[new(felt.Felt).SetBytes(token[:]).String()] = balance.String()
		}

		users = append(users, &UserData{
			Address:         new(felt.Felt).SetBytes(userAddr[:]).String(),
			AccruedBalances: accruedBalances,
			PromptCount:     int(info.PromptCount),
			BreakCount:      int(info.BreakCount),
		})
	}

	c.JSON(http.StatusOK, &UserPageResponse{
		Users:     users,
		Total:     int(leaderboard.UserCount),
		Page:      page,
		PageSize:  pageSize,
		LastBlock: int(leaderboard.LastBlock),
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

	latestPrompts := make([]*AgentDataPrompt, 0, len(usage.LatestPrompts))
	for _, prompt := range usage.LatestPrompts {
		latestPrompts = append(latestPrompts, s.buildAgentDataPrompt(prompt))
	}

	var drainPrompt *AgentDataPrompt
	if usage.DrainPrompt != nil {
		drainPrompt = s.buildAgentDataPrompt(usage.DrainPrompt)
	}

	return &AgentData{
		Pending:       balance.Pending,
		Address:       info.Address.String(),
		Creator:       info.Creator.String(),
		Name:          info.Name,
		SystemPrompt:  info.SystemPrompt,
		Token:         balance.Token.String(),
		Balance:       new(big.Int).Sub(balance.Amount, balance.PendingAmount).String(),
		EndTime:       strconv.FormatUint(balance.EndTime, 10),
		Model:         info.Model.String(),
		IsDrained:     usage.IsDrained,
		DrainAmount:   balance.DrainAmount.String(),
		DrainPrompt:   drainPrompt,
		IsFinalized:   time.Now().After(time.Unix(int64(balance.EndTime), 0)) || usage.IsDrained,
		IsWithdrawn:   usage.IsWithdrawn,
		PromptPrice:   info.PromptPrice.String(),
		BreakAttempts: strconv.FormatUint(usage.BreakAttempts, 10),
		LatestPrompts: latestPrompts,
	}, nil
}

func (s *UIService) buildAgentDataPrompt(prompt *indexer.AgentUsagePrompt) *AgentDataPrompt {
	return &AgentDataPrompt{
		PromptID:  strconv.FormatUint(prompt.PromptID, 10),
		TweetID:   strconv.FormatUint(prompt.TweetID, 10),
		Prompt:    prompt.Prompt,
		User:      prompt.User.String(),
		IsSuccess: prompt.IsSuccess,
		DrainedTo: prompt.DrainedTo.String(),
	}
}

func (s *UIService) buildUserData(info *indexer.UserInfo) *UserData {
	flt := new(felt.Felt)
	accruedBalances := make(map[string]string)
	for token, balance := range info.AccruedBalances {
		flt.SetBytes(token[:])
		accruedBalances[flt.String()] = balance.String()
	}

	flt.SetBytes(info.Address[:])

	return &UserData{
		Address:         flt.String(),
		AccruedBalances: accruedBalances,
		PromptCount:     int(info.PromptCount),
		BreakCount:      int(info.BreakCount),
	}
}

// RegisterPromptResponseRequest represents the request body for registering a prompt response
type RegisterPromptResponseRequest struct {
	PromptID    *uint64 `json:"prompt_id" binding:"required"`
	AgentAddr   *string `json:"agent_addr" binding:"required"`
	Price       *string `json:"price" binding:"required"`
	IsDrain     *bool   `json:"is_drain" binding:"required"`
	Prompt      *string `json:"prompt" binding:"required"`
	Response    *string `json:"response"`
	Error       *string `json:"error"`
	BlockNumber *uint64 `json:"block_number" binding:"required"`
	UserAddr    *string `json:"user_addr" binding:"required"`
}

func (s *UIService) HandleRegisterPromptResponse(c *gin.Context) {
	// Validate API key if configured
	if s.promptIndexerApiKey != "" {
		apiKey := c.GetHeader("X-API-Key")
		if apiKey != s.promptIndexerApiKey {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or missing API key"})
			return
		}
	}

	var req RegisterPromptResponseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request: %v", err)})
		return
	}

	agentAddr, err := new(felt.Felt).SetString(*req.AgentAddr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid agent address: %v", err)})
		return
	}

	userAddr, err := new(felt.Felt).SetString(*req.UserAddr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid user address: %v", err)})
		return
	}

	data := &indexer.PromptData{
		Pending:     false,
		PromptID:    *req.PromptID,
		AgentAddr:   agentAddr,
		IsDrain:     *req.IsDrain,
		Prompt:      *req.Prompt,
		Response:    req.Response,
		Error:       req.Error,
		BlockNumber: *req.BlockNumber,
		UserAddr:    userAddr,
	}

	if err := s.promptIndexer.RegisterPromptResponse(data, true); err != nil {
		slog.Error("failed to register prompt response", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register prompt response"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

type PromptData struct {
	Pending     bool   `json:"pending"`
	PromptID    string `json:"prompt_id"`
	AgentAddr   string `json:"agent_addr"`
	IsDrain     bool   `json:"is_drain"`
	Prompt      string `json:"prompt"`
	Response    string `json:"response,omitempty"`
	Error       string `json:"error,omitempty"`
	BlockNumber string `json:"block_number"`
	UserAddr    string `json:"user_addr"`
}

type PromptPageResponse struct {
	Prompts   []*PromptData `json:"prompts"`
	Total     int           `json:"total"`
	Page      int           `json:"page"`
	PageSize  int           `json:"page_size"`
	LastBlock int           `json:"last_block"`
}

func (s *UIService) HandleGetUserPrompts(c *gin.Context) {
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

	start := page * pageSize
	end := (page + 1) * pageSize

	prompts, err := s.promptIndexer.GetPromptsByUser(userAddr, start, end)
	if err != nil {
		slog.Error("error fetching user prompts", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user prompts"})
		return
	}

	promptDatas := make([]*PromptData, 0, len(prompts))
	for _, prompt := range prompts {
		response := ""
		if prompt.Response != nil {
			response = *prompt.Response
		}
		errorMsg := ""
		if prompt.Error != nil {
			errorMsg = *prompt.Error
		}

		promptDatas = append(promptDatas, &PromptData{
			Pending:     prompt.Pending,
			PromptID:    strconv.FormatUint(prompt.PromptID, 10),
			AgentAddr:   prompt.AgentAddr.String(),
			IsDrain:     prompt.IsDrain,
			Prompt:      prompt.Prompt,
			Response:    response,
			Error:       errorMsg,
			BlockNumber: strconv.FormatUint(prompt.BlockNumber, 10),
			UserAddr:    prompt.UserAddr.String(),
		})
	}

	c.JSON(http.StatusOK, &PromptPageResponse{
		Prompts:   promptDatas,
		Total:     len(prompts),
		Page:      page,
		PageSize:  pageSize,
		LastBlock: int(s.promptIndexer.GetLastIndexedBlock()),
	})
}

func (s *UIService) HandleGetPromptResponse(c *gin.Context) {
	promptIDStr := c.Query("prompt_id")
	if promptIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prompt_id required"})
		return
	}

	promptID, err := strconv.ParseUint(promptIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prompt_id"})
		return
	}

	agentAddrStr := c.Query("agent_addr")
	if agentAddrStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_addr required"})
		return
	}

	agentAddr, err := new(felt.Felt).SetString(agentAddrStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("invalid agent address: %w", err).Error()})
		return
	}

	prompt, exists := s.promptIndexer.GetPrompt(promptID, agentAddr)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "prompt not found"})
		return
	}

	response := ""
	if prompt.Response != nil {
		response = *prompt.Response
	}
	errorMsg := ""
	if prompt.Error != nil {
		errorMsg = *prompt.Error
	}

	c.JSON(http.StatusOK, &PromptData{
		Pending:     prompt.Pending,
		PromptID:    strconv.FormatUint(prompt.PromptID, 10),
		AgentAddr:   prompt.AgentAddr.String(),
		IsDrain:     prompt.IsDrain,
		Prompt:      prompt.Prompt,
		Response:    response,
		Error:       errorMsg,
		BlockNumber: strconv.FormatUint(prompt.BlockNumber, 10),
		UserAddr:    prompt.UserAddr.String(),
	})
}
