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
		c.String(http.StatusOK, a.account.Address().String())
	})

	router.GET("/deploy-account", func(c *gin.Context) {
		err := a.account.Deploy(context.Background(), a.starknetClient)
		if err != nil {
			c.String(http.StatusInternalServerError, err.Error())
			return
		}

		c.String(http.StatusOK, "deployed")
	})

	router.GET("/quote", func(c *gin.Context) {
		quote, err := a.quote(c.Request.Context())
		if err != nil {
			c.String(http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, quote)
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
