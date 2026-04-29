package shiftschedules

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.ShiftScheduleHandler{DB: db}

	ss := g.Group("/shift-schedules")
	ss.GET("", h.List)
	ss.POST("", h.Create)
	ss.GET("/:id", h.Get)
}
