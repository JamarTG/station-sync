package tanks

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.TankHandler{DB: db}
	g.GET("/tanks", h.List)
	g.POST("/tanks", h.Create)
}
