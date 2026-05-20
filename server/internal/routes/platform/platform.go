package platform

import (
	"project-sync/internal/handlers"
	"project-sync/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.PlatformHandler{DB: db}

	p := g.Group("/platform")
	p.Use(middleware.RequirePlatformAdmin)
	p.GET("/accounts", h.ListAccounts)
}
