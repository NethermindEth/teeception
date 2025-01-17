package service

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/teeception/pkg/indexer"
	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
)

type AgentServiceConfig struct {
	Client          *rpc.Provider
	AdminToken      string
	PageSize        int
	ServerAddr      string
	RegistryAddress *felt.Felt
}

type AgentService struct {
	eventWatcher         *indexer.EventWatcher
	agentIndexer         *indexer.AgentIndexer
	agentMetadataIndexer *indexer.AgentMetadataIndexer
	agentBalanceIndexer  *indexer.AgentBalanceIndexer
	tokenIndexer         *indexer.TokenIndexer

	registryAddress *felt.Felt

	client     *rpc.Provider
	adminToken string

	pageSize   int
	serverAddr string
}

func NewAgentService(config *AgentServiceConfig) (*AgentService, error) {
	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          config.Client,
		SafeBlockDelta:  0,
		TickRate:        2 * time.Second,
		IndexChunkSize:  1000,
		RegistryAddress: config.RegistryAddress,
	})
	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
	})
	agentMetadataIndexer := indexer.NewAgentMetadataIndexer(&indexer.AgentMetadataIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
	})
	// TODO: implement price feed
	priceFeed := &PriceService{}
	tokenIndexer := indexer.NewTokenIndexer(&indexer.TokenIndexerConfig{
		Client:          config.Client,
		PriceFeed:       priceFeed,
		PriceTickRate:   1 * time.Minute,
		RegistryAddress: config.RegistryAddress,
	})
	agentBalanceIndexer := indexer.NewAgentBalanceIndexer(&indexer.AgentBalanceIndexerConfig{
		Client:          config.Client,
		AgentIdx:        agentIndexer,
		MetaIdx:         agentMetadataIndexer,
		TickRate:        1 * time.Minute,
		SafeBlockDelta:  0,
		RegistryAddress: config.RegistryAddress,
		PriceCache:      tokenIndexer,
	})

	return &AgentService{
		eventWatcher:         eventWatcher,
		agentIndexer:         agentIndexer,
		agentMetadataIndexer: agentMetadataIndexer,
		agentBalanceIndexer:  agentBalanceIndexer,
		tokenIndexer:         tokenIndexer,

		registryAddress: config.RegistryAddress,

		client:     config.Client,
		adminToken: config.AdminToken,
		pageSize:   config.PageSize,
		serverAddr: config.ServerAddr,
	}, nil
}

func (s *AgentService) Run(ctx context.Context) error {
	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return s.eventWatcher.Run(ctx)
	})
	g.Go(func() error {
		return s.agentIndexer.Run(ctx, s.eventWatcher)
	})
	g.Go(func() error {
		return s.agentMetadataIndexer.Run(ctx, s.eventWatcher)
	})
	g.Go(func() error {
		return s.agentBalanceIndexer.Run(ctx, s.eventWatcher)
	})
	g.Go(func() error {
		return s.tokenIndexer.Run(ctx, s.eventWatcher)
	})
	g.Go(func() error {
		return s.startServer(ctx)
	})
	return g.Wait()
}

func (s *AgentService) startServer(ctx context.Context) error {
	router := gin.Default()

	router.GET("/agents", s.HandleGetAgents)

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
	Address string `json:"address"`
	Token   string `json:"token"`
	Name    string `json:"name"`
	Balance string `json:"balance"`
}

type AgentLeaderboardResponse struct {
	Agents    []*AgentData `json:"agents"`
	Total     int          `json:"total"`
	Page      int          `json:"page"`
	PageSize  int          `json:"page_size"`
	LastBlock int          `json:"last_block"`
}

func (s *AgentService) HandleGetAgents(c *gin.Context) {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil {
		page = 1
	}

	agents, err := s.agentBalanceIndexer.GetAgentLeaderboard(uint64(page-1)*uint64(s.pageSize), uint64(page)*uint64(s.pageSize))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

		balance, ok := s.agentBalanceIndexer.GetBalance(agentAddr)
		if !ok {
			slog.Error("failed to get agent balance", "error", err)
			continue
		}

		agentDatas = append(agentDatas, &AgentData{
			Address: agentAddr.String(),
			Name:    info.Name,
			Token:   balance.Token.String(),
			Balance: balance.Amount.String(),
		})
	}

	c.JSON(http.StatusOK, &AgentLeaderboardResponse{
		Agents:    agentDatas,
		Total:     int(agents.AgentCount),
		Page:      page,
		PageSize:  s.pageSize,
		LastBlock: int(agents.LastBlock),
	})
}

func (s *AgentService) HandleGetAgent(c *gin.Context) {
	agentAddrStr := c.Param("address")
	agentAddr, err := new(felt.Felt).SetString(agentAddrStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("invalid agent address: %w", err).Error()})
		return
	}

	balance, ok := s.agentBalanceIndexer.GetBalance(agentAddr)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	info, ok := s.agentIndexer.GetAgentInfo(agentAddr)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	c.JSON(http.StatusOK, &AgentData{
		Address: agentAddr.String(),
		Name:    info.Name,
		Token:   balance.Token.String(),
		Balance: balance.Amount.String(),
	})
}
