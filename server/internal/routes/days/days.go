package days

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.DayHandler{DB: db}
	g.GET("/days", h.List)
}
