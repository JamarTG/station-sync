package main

import (
	"context"
	"log"

	"project-sync/internal/config"
	"project-sync/internal/db"
	"project-sync/internal/routes"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	pool, err := db.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	if err := db.EnsureSchema(context.Background(), pool); err != nil {
		log.Fatalf("failed to ensure schema: %v", err)
	}

	r := gin.Default()

	routes.Register(r, pool)

	r.GET("/health", func(c *gin.Context) {
		c.String(200, "OK")
	})

	r.Run(":" + cfg.Port)
}
