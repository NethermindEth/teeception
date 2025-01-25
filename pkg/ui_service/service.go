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
	Client          starknet.ProviderWrapper
	PageSize        int
	ServerAddr      string
	RegistryAddress *felt.Felt
	StartingBlock   uint64
	TokenRates      map[[32]byte]*big.Int
}

type UIService struct {
	eventWatcher         *indexer.EventWatcher
	agentIndexer         *indexer.AgentIndexer
	agentMetadataIndexer *indexer.AgentMetadataIndexer
	agentBalanceIndexer  *indexer.AgentBalanceIndexer
	tokenIndexer         *indexer.TokenIndexer

	registryAddress *felt.Felt

	client starknet.ProviderWrapper

	pageSize   int
	serverAddr string
}

func NewUIService(config *UIServiceConfig) (*UIService, error) {
	lastIndexedBlock := config.StartingBlock - 1

	eventWatcher := indexer.NewEventWatcher(&indexer.EventWatcherConfig{
		Client:          config.Client,
		SafeBlockDelta:  0,
		TickRate:        2 * time.Second,
		IndexChunkSize:  1000,
		RegistryAddress: config.RegistryAddress,
		InitialState: &indexer.EventWatcherInitialState{
			LastIndexedBlock: lastIndexedBlock,
		},
	})
	agentIndexer := indexer.NewAgentIndexer(&indexer.AgentIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		InitialState: &indexer.AgentIndexerInitialState{
			Agents:           make(map[[32]byte]indexer.AgentInfo),
			LastIndexedBlock: lastIndexedBlock,
		},
	})
	agentMetadataIndexer := indexer.NewAgentMetadataIndexer(&indexer.AgentMetadataIndexerConfig{
		Client:          config.Client,
		RegistryAddress: config.RegistryAddress,
		InitialState: &indexer.AgentMetadataIndexerInitialState{
			Metadata:         make(map[[32]byte]indexer.AgentMetadata),
			LastIndexedBlock: config.StartingBlock - 1,
		},
	})
	priceFeed := price.NewStaticPriceFeed(config.TokenRates)
	tokenIndexer := indexer.NewTokenIndexer(&indexer.TokenIndexerConfig{
		PriceFeed:       priceFeed,
		PriceTickRate:   5 * time.Second,
		RegistryAddress: config.RegistryAddress,
		InitialState: &indexer.TokenIndexerInitialState{
			Tokens:           make(map[[32]byte]*indexer.TokenInfo),
			LastIndexedBlock: lastIndexedBlock,
		},
	})
	agentBalanceIndexer := indexer.NewAgentBalanceIndexer(&indexer.AgentBalanceIndexerConfig{
		Client:          config.Client,
		AgentIdx:        agentIndexer,
		MetaIdx:         agentMetadataIndexer,
		TickRate:        5 * time.Second,
		SafeBlockDelta:  0,
		RegistryAddress: config.RegistryAddress,
		PriceCache:      tokenIndexer,
		InitialState: &indexer.AgentBalanceIndexerInitialState{
			Balances:         make(map[[32]byte]*indexer.AgentBalance),
			LastIndexedBlock: lastIndexedBlock,
		},
	})

	return &UIService{
		eventWatcher:         eventWatcher,
		agentIndexer:         agentIndexer,
		agentMetadataIndexer: agentMetadataIndexer,
		agentBalanceIndexer:  agentBalanceIndexer,
		tokenIndexer:         tokenIndexer,

		registryAddress: config.RegistryAddress,

		client:     config.Client,
		pageSize:   config.PageSize,
		serverAddr: config.ServerAddr,
	}, nil
}

func (s *UIService) Run(ctx context.Context) error {
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

func (s *UIService) startServer(ctx context.Context) error {
	router := gin.Default()

	router.GET("/agents", s.HandleGetAgents)
	router.GET("/agent/:address", s.HandleGetAgent)

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
	Pending bool   `json:"pending"`
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

func (s *UIService) HandleGetAgents(c *gin.Context) {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil {
		page = 1
	}

	agents, err := s.agentBalanceIndexer.GetAgentLeaderboard(uint64(page-1)*uint64(s.pageSize), uint64(page)*uint64(s.pageSize))
	if err != nil {
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

		balance, ok := s.agentBalanceIndexer.GetBalance(agentAddr)
		if !ok {
			slog.Error("failed to get agent balance", "error", err)
			continue
		}

		agentDatas = append(agentDatas, &AgentData{
			Pending: balance.Pending,
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

func (s *UIService) HandleGetAgent(c *gin.Context) {
	agentAddrStr := c.Param("address")
	agentAddr, err := new(felt.Felt).SetString(agentAddrStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("invalid agent address: %w", err).Error()})
		return
	}

	balance, ok := s.agentBalanceIndexer.GetBalance(agentAddr)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found in balance indexer"})
		return
	}

	info, ok := s.agentIndexer.GetAgentInfo(agentAddr)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found in agent indexer"})
		return
	}

	c.JSON(http.StatusOK, &AgentData{
		Pending: balance.Pending,
		Address: agentAddr.String(),
		Name:    info.Name,
		Token:   balance.Token.String(),
		Balance: balance.Amount.String(),
	})
}
