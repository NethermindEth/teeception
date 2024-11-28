package agent

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (a *Agent) StartServer(ctx context.Context) error {
	router := gin.Default()

	router.GET("/address", func(c *gin.Context) {
		c.String(http.StatusOK, a.accountAddress.String())
	})

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
		}
	}()

	go func() {
		<-ctx.Done()
		if err := server.Shutdown(context.Background()); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
	}()

	return nil
}
