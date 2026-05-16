package auth

import (
	"project-sync/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoute(g *gin.RouterGroup, db *pgxpool.Pool) {
	h := &handlers.AuthHandler{DB: db}
	g.POST("/auth/login", h.Login)
	g.POST("/auth/signup", h.SignUp)
}
