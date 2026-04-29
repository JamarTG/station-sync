package fuels

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.FuelHandler{DB: db}

	fuels := g.Group("/fuels")
	fuels.GET("", h.List)
	fuels.POST("", h.Create)
	fuels.GET("/:fuelId/pumps", h.ListPumps)
}
