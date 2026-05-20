package timeoff

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.TimeOffRequestHandler{DB: db}

	g.GET("/time-off-requests", h.List)
	g.POST("/time-off-requests", h.Create)
	g.PATCH("/time-off-requests/:id/:action", h.Review)
}
