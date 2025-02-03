package agent

import (
	"context"
	"encoding/base64"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (a *Agent) StartServer(ctx context.Context) error {
	router := gin.Default()

	router.GET("/address", func(c *gin.Context) {
		c.String(http.StatusOK, a.account.Address().String())
	})

	router.GET("/pubkey", func(c *gin.Context) {
		c.String(http.StatusOK, a.account.PublicKey().String())
	})

	router.GET("/unencumber", func(c *gin.Context) {
		resp := gin.H{
			"status": a.isUnencumbered,
		}

		if a.isUnencumbered {
			resp["twitter_password"] = base64.StdEncoding.EncodeToString(a.unencumberData.EncryptedTwitterPassword)
			resp["email_password"] = base64.StdEncoding.EncodeToString(a.unencumberData.EncryptedEmailPassword)
		}

		c.JSON(http.StatusOK, resp)
	})

	router.GET("/deployment", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"already_deployed":   a.accountDeploymentState.AlreadyDeployed,
			"deployment_error":   a.accountDeploymentState.DeploymentErr.Error(),
			"deployed_at":        a.accountDeploymentState.DeployedAt,
			"balance":            a.accountDeploymentState.Balance.String(),
			"balance_updated_at": a.accountDeploymentState.BalanceUpdatedAt,
		})
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
