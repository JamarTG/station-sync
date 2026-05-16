package users

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.UserHandler{DB: db}

	users := g.Group("/users")
	users.GET("", h.List)
	users.POST("", h.Create)
	users.GET("/:id", h.Get)
	users.PATCH("/:id/pay", h.UpdatePay)
}
