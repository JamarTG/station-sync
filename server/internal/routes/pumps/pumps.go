package pumps

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.PumpHandler{DB: db}
	nh := &handlers.NozzleHandler{DB: db}

	pumps := g.Group("/pumps")
	pumps.GET("", h.List)
	pumps.POST("", h.Create)
	pumps.GET("/:pumpId", h.Get)
	pumps.GET("/:pumpId/nozzles", nh.ListByPump)
	pumps.POST("/:pumpId/nozzles", nh.Create)
	pumps.GET("/:pumpId/shifts/:shiftId/litres-sold-by-fuel", h.GetShiftFuelSales)
	pumps.GET("/:pumpId/shifts/:shiftId/fuel-summary", h.GetFuelSummary)
}
