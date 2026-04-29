package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL string
	Port        string
}

func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		host := getEnvOrDefault("DB_HOST", "localhost")
		port := getEnvOrDefault("DB_PORT", "5432")
		user := getEnvOrDefault("DB_USER", "postgres")
		password := os.Getenv("DB_PASSWORD")
		name := getEnvOrDefault("DB_NAME", "station_sync")
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s", user, password, host, port, name)
	}

	return &Config{
		DatabaseURL: dbURL,
		Port:        getEnvOrDefault("PORT", "8080"),
	}, nil
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
